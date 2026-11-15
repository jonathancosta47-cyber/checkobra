-- FVS: fotos por item, assinaturas, PDF salvo e regras para concluir.
--  • fvs_fotos (era "fotos", nunca usada): cada foto ligada ao item respondido.
--  • Arquivos no Storage em <empresa>/<empreendimento>/<fvs>/<arquivo> (bucket fvs-fotos).
--  • PDF gerado ao concluir, salvo no bucket fvs-pdfs e registrado na FVS.
--  • Concluir exige: todos os itens respondidos, NC descrita, foto onde o modelo exige
--    e a assinatura do inspetor (o banco confere, não só a tela).

-- texto → uuid sem erro (pastas do Storage podem ter qualquer nome)
create function public.uuid_ou_nulo(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ───────────────────────── fvs_fotos ─────────────────────────

alter table public.fotos rename to fvs_fotos;
drop policy fotos_ver on public.fvs_fotos;
drop policy fotos_criar on public.fvs_fotos;
drop policy fotos_editar on public.fvs_fotos;
drop policy fotos_apagar on public.fvs_fotos;
alter table public.fvs_fotos drop constraint if exists fotos_check;
alter table public.fvs_fotos rename constraint fotos_storage_path_key to fvs_fotos_storage_path_key;
alter index public.fotos_inspecao rename to fvs_fotos_inspecao;

alter table public.fvs_fotos
  add column empreendimento_id uuid not null,
  add column ordem integer not null default 0,
  alter column resposta_id set not null,
  add constraint fvs_fotos_empreendimento_fk foreign key (empresa_id, empreendimento_id)
    references public.empreendimentos (empresa_id, id) on delete cascade,
  -- o arquivo fica na pasta da empresa e do empreendimento
  add constraint fvs_fotos_caminho check (storage_path like empresa_id::text || '/' || empreendimento_id::text || '/%');
create index fvs_fotos_resposta on public.fvs_fotos (empresa_id, resposta_id, ordem);

-- a foto é do item (resposta) daquela FVS, no mesmo empreendimento da FVS
create function public.validar_foto_fvs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.respostas r join public.inspecoes i on i.id = r.inspecao_id
    where r.id = new.resposta_id and i.id = new.inspecao_id and i.empreendimento_id = new.empreendimento_id
  ) then
    raise exception 'A foto precisa ser de um item desta FVS' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger fvs_fotos_valida before insert or update on public.fvs_fotos
  for each row execute function public.validar_foto_fvs();

-- vê quem enxerga a FVS; envia/edita/apaga quem pode editar a FVS
create policy fvs_fotos_ver on public.fvs_fotos for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_inspecao(inspecao_id));
create policy fvs_fotos_criar on public.fvs_fotos for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and public.pode_editar_inspecao(inspecao_id));
create policy fvs_fotos_editar on public.fvs_fotos for update to authenticated
  using (public.pode_editar_inspecao(inspecao_id))
  with check (empresa_id = (select public.minha_empresa_id()) and public.pode_editar_inspecao(inspecao_id));
create policy fvs_fotos_apagar on public.fvs_fotos for delete to authenticated
  using (public.pode_editar_inspecao(inspecao_id));

-- ───────────────────────── FVS: assinaturas e PDF ─────────────────────────

alter table public.inspecoes drop column assinatura_path, drop column assinado_por;
alter table public.inspecoes
  -- [{"papel": "inspetor" | "empreiteiro", "nome": "...", "imagem": "data:image/png;base64,..."}]
  add column assinaturas jsonb not null default '[]' check (jsonb_typeof(assinaturas) = 'array'),
  add column pdf_path text,
  add column pdf_gerado_em timestamptz,
  add constraint inspecoes_pdf_caminho check (pdf_path is null or pdf_path like empresa_id::text || '/' || empreendimento_id::text || '/' || id::text || '/%');

-- Regras para concluir (conferidas pelo banco).
create function public.validar_conclusao_fvs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  faltam integer;
begin
  if new.status <> 'concluida' or old.status = 'concluida' then
    return new;
  end if;
  select count(*) into faltam from public.respostas where inspecao_id = new.id and resultado is null;
  if faltam > 0 then
    raise exception 'Faltam % itens sem resposta', faltam using errcode = '23514';
  end if;
  if exists (select 1 from public.respostas where inspecao_id = new.id and resultado = 'NC' and trim(observacao) = '') then
    raise exception 'Descreva o problema de todos os itens não conformes' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.respostas r
    where r.inspecao_id = new.id and r.exige_foto and r.resultado in ('C', 'NC')
      and not exists (select 1 from public.fvs_fotos f where f.resposta_id = r.id)
  ) then
    raise exception 'Há itens que exigem foto e estão sem foto' using errcode = '23514';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(new.assinaturas) a
    where a->>'papel' = 'inspetor' and coalesce(a->>'imagem', '') like 'data:image/%'
  ) then
    raise exception 'Falta a assinatura do inspetor' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger inspecoes_conclusao before update of status on public.inspecoes
  for each row execute function public.validar_conclusao_fvs();

-- Registra o PDF gerado. Quem enxerga a FVS concluída pode registrar (o inspetor que concluiu
-- não pode mais editar a FVS, então isto não passa pela política de edição).
create function public.registrar_pdf_fvs(p_inspecao uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.inspecoes;
begin
  select * into i from public.inspecoes where id = p_inspecao;
  if not found or not public.pode_ver_inspecao(p_inspecao) or i.empresa_id <> public.minha_empresa_id() then
    raise exception 'FVS não encontrada' using errcode = 'P0002';
  end if;
  if i.status <> 'concluida' then
    raise exception 'O PDF oficial é gerado depois de concluir a FVS' using errcode = '23514';
  end if;
  if p_path not like i.empresa_id::text || '/' || i.empreendimento_id::text || '/' || i.id::text || '/%' then
    raise exception 'Caminho do PDF inválido' using errcode = '23514';
  end if;
  update public.inspecoes set pdf_path = p_path, pdf_gerado_em = now() where id = p_inspecao;
end $$;

-- ───────────────────────── Storage ─────────────────────────

-- caminho <empresa>/<empreendimento>/<fvs>/<arquivo> aponta para uma FVS daquele empreendimento?
create function public.caminho_da_fvs(p_nome text) returns uuid
language sql stable security definer set search_path = '' as $$
  select i.id from public.inspecoes i
  where i.id = public.uuid_ou_nulo((storage.foldername(p_nome))[3])
    and i.empreendimento_id = public.uuid_ou_nulo((storage.foldername(p_nome))[2])
    and i.empresa_id = public.uuid_ou_nulo((storage.foldername(p_nome))[1])
$$;

-- fotos: troca as políticas antigas (só por empresa) pelas novas (empresa + empreendimento + FVS)
drop policy fvs_fotos_ver on storage.objects;
drop policy fvs_fotos_enviar on storage.objects;
drop policy fvs_fotos_apagar on storage.objects;
create policy fvs_fotos_arquivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fvs-fotos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and public.pode_ver_inspecao(public.caminho_da_fvs(name)));
create policy fvs_fotos_arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fvs-fotos'
              and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
              and public.pode_editar_inspecao(public.caminho_da_fvs(name)));
create policy fvs_fotos_arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fvs-fotos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and public.pode_editar_inspecao(public.caminho_da_fvs(name)));

-- PDFs das FVS concluídas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fvs-pdfs', 'fvs-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy fvs_pdfs_ver on storage.objects for select to authenticated
  using (bucket_id = 'fvs-pdfs'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and public.pode_ver_inspecao(public.caminho_da_fvs(name)));
create policy fvs_pdfs_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fvs-pdfs'
              and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
              and public.pode_ver_inspecao(public.caminho_da_fvs(name))
              and exists (select 1 from public.inspecoes i where i.id = public.caminho_da_fvs(name) and i.status = 'concluida'));
create policy fvs_pdfs_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fvs-pdfs'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and (select public.tem_papel('admin_empresa', 'engenheiro')));

revoke execute on function public.registrar_pdf_fvs(uuid, text), public.caminho_da_fvs(text), public.uuid_ou_nulo(text) from public, anon;
grant execute on function public.registrar_pdf_fvs(uuid, text), public.caminho_da_fvs(text), public.uuid_ou_nulo(text) to authenticated;
revoke execute on function public.validar_foto_fvs(), public.validar_conclusao_fvs() from public, anon, authenticated;
