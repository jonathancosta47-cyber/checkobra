-- Empreendimentos — parte 2: "obras" viram "empreendimentos", base de todos os módulos.
-- Renomear mantém os dados, as chaves estrangeiras e o RLS que já existem.

-- ───────────────────────── renomear obras → empreendimentos ─────────────────────────

alter table public.obras rename to empreendimentos;
alter table public.empreendimentos add column foto_path text;
alter table public.empreendimentos add constraint empreendimentos_foto_na_pasta_da_empresa
  check (foto_path is null or foto_path like empresa_id::text || '/%');
alter index public.obras_empresa rename to empreendimentos_empresa;
alter trigger obras_updated on public.empreendimentos rename to empreendimentos_updated;

alter table public.locais rename column obra_id to empreendimento_id;
alter index public.locais_obra_pai rename to locais_empreendimento_pai;
alter table public.inspecoes rename column obra_id to empreendimento_id;

-- ───────────────────────── área comum na hierarquia ─────────────────────────
-- torre e área comum podem ficar na raiz; pavimento dentro de torre; unidade dentro de pavimento;
-- área comum também pode ficar dentro de torre ou pavimento (ex.: hall do 1º pavimento).

alter table public.locais drop constraint if exists locais_check;
alter table public.locais add constraint locais_raiz_valida
  check ((tipo in ('torre', 'area_comum')) or pai_id is not null);
alter table public.locais add constraint locais_torre_na_raiz
  check (tipo <> 'torre' or pai_id is null);

create or replace function public.validar_hierarquia_local() returns trigger
language plpgsql set search_path = '' as $$
declare
  tipo_pai public.tipo_local;
begin
  if new.pai_id is null then
    return new;
  end if;
  select l.tipo into tipo_pai from public.locais l where l.id = new.pai_id;
  if (new.tipo = 'pavimento' and tipo_pai is distinct from 'torre')
     or (new.tipo = 'unidade' and tipo_pai is distinct from 'pavimento')
     or (new.tipo = 'area_comum' and tipo_pai not in ('torre', 'pavimento')) then
    raise exception 'Hierarquia inválida: % não pode ficar dentro de %', new.tipo, coalesce(tipo_pai::text, 'nada')
      using errcode = '23514';
  end if;
  return new;
end $$;

-- ───────────────────────── inspetor só vê empreendimentos liberados ─────────────────────────

create table public.empreendimento_membros (
  empresa_id uuid not null default public.minha_empresa_id() references public.empresas (id) on delete cascade,
  empreendimento_id uuid not null,
  perfil_id uuid not null,
  liberado_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (empreendimento_id, perfil_id),
  foreign key (empresa_id, empreendimento_id) references public.empreendimentos (empresa_id, id) on delete cascade,
  foreign key (empresa_id, perfil_id) references public.perfis (empresa_id, id) on delete cascade
);
create index empreendimento_membros_perfil on public.empreendimento_membros (perfil_id);

-- Admin e engenheiro veem todos os empreendimentos da empresa; inspetor só os liberados para ele.
-- Não consulta a tabela empreendimentos de propósito: numa inserção com RETURNING a linha nova
-- ainda não aparece para esta função. A empresa é conferida em cada política (empresa_id = minha_empresa_id()),
-- e a liberação do inspetor só pode apontar para empreendimento da mesma empresa (chave estrangeira).
create function public.pode_ver_empreendimento(p_empreendimento uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfis pf
    where pf.id = auth.uid() and pf.ativo
      and (pf.papel in ('admin_empresa', 'engenheiro')
           or exists (select 1 from public.empreendimento_membros m
                      where m.empreendimento_id = p_empreendimento and m.perfil_id = pf.id))
  )
$$;

create function public.pode_ver_inspecao(p_inspecao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inspecoes i
    where i.id = p_inspecao and public.pode_ver_empreendimento(i.empreendimento_id)
  )
$$;

-- Editar inspeção agora também exige enxergar o empreendimento (inspetor removido perde o acesso).
create or replace function public.pode_editar_inspecao(p_inspecao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.inspecoes i
    join public.perfis p on p.id = auth.uid() and p.ativo and p.empresa_id = i.empresa_id
    where i.id = p_inspecao
      and public.pode_ver_empreendimento(i.empreendimento_id)
      and (p.papel in ('admin_empresa', 'engenheiro') or (i.inspetor_id = p.id and i.status = 'rascunho'))
  )
$$;

-- ───────────────────────── permissões ─────────────────────────

revoke all on public.empreendimento_membros from anon, authenticated;
grant select, insert, delete on public.empreendimento_membros to authenticated;
grant all on public.empreendimento_membros to service_role;
alter table public.empreendimento_membros enable row level security;

create policy membros_ver on public.empreendimento_membros for select to authenticated
  using (empresa_id = (select public.minha_empresa_id())
         and ((select public.tem_papel('admin_empresa', 'engenheiro')) or perfil_id = (select auth.uid())));
create policy membros_liberar on public.empreendimento_membros for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));
create policy membros_remover on public.empreendimento_membros for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));

-- empreendimentos: troca as políticas de "obras" pelas novas (com a regra do inspetor)
drop policy obras_ver on public.empreendimentos;
drop policy obras_criar on public.empreendimentos;
drop policy obras_editar on public.empreendimentos;
drop policy obras_apagar on public.empreendimentos;
create policy empreendimentos_ver on public.empreendimentos for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(id));
create policy empreendimentos_criar on public.empreendimentos for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')));
create policy empreendimentos_editar on public.empreendimentos for update to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')))
  with check (empresa_id = (select public.minha_empresa_id()));
create policy empreendimentos_apagar on public.empreendimentos for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));

-- locais: só os de empreendimentos visíveis
drop policy locais_ver on public.locais;
create policy locais_ver on public.locais for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));

-- inspeções (FVS): só de empreendimentos visíveis
drop policy inspecoes_ver on public.inspecoes;
drop policy inspecoes_criar on public.inspecoes;
create policy inspecoes_ver on public.inspecoes for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));
create policy inspecoes_criar on public.inspecoes for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and inspetor_id = (select auth.uid())
              and public.pode_ver_empreendimento(empreendimento_id));

-- respostas, fotos e não conformidades seguem a inspeção
drop policy respostas_ver on public.respostas;
drop policy fotos_ver on public.fotos;
drop policy nc_ver on public.nao_conformidades;
create policy respostas_ver on public.respostas for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_inspecao(inspecao_id));
create policy fotos_ver on public.fotos for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_inspecao(inspecao_id));
create policy nc_ver on public.nao_conformidades for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_inspecao(inspecao_id));

-- ───────────────────────── assistente: gerar a estrutura de uma vez ─────────────────────────
-- Cria o empreendimento com torres (A, B, C...), pavimentos e unidades numeradas
-- (pavimento × 100 + unidade: 101, 102... 1004) e as áreas comuns na raiz.
-- Roda com as permissões de quem chama (RLS vale): só admin e engenheiro conseguem.

create function public.criar_empreendimento(
  p_nome text,
  p_endereco text default '',
  p_torres integer default 1,
  p_pavimentos integer default 1,
  p_unidades integer default 1,
  p_areas_comuns text[] default '{}'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  emp uuid;
  torre uuid;
  pav uuid;
  area text;
  k integer := 0;
begin
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do empreendimento' using errcode = '23514';
  end if;
  if p_torres not between 0 and 26 or p_pavimentos not between 1 and 200 or p_unidades not between 1 and 99 then
    raise exception 'Use de 0 a 26 torres, 1 a 200 pavimentos e 1 a 99 unidades por pavimento' using errcode = '23514';
  end if;

  insert into public.empreendimentos (nome, endereco) values (trim(p_nome), coalesce(trim(p_endereco), ''))
  returning id into emp;

  for t in 1..p_torres loop
    insert into public.locais (empreendimento_id, tipo, nome, ordem)
    values (emp, 'torre', 'Torre ' || chr(64 + t), t) returning id into torre;
    for p in 1..p_pavimentos loop
      insert into public.locais (empreendimento_id, pai_id, tipo, nome, ordem)
      values (emp, torre, 'pavimento', p || 'º pavimento', p) returning id into pav;
      insert into public.locais (empreendimento_id, pai_id, tipo, nome, ordem)
      select emp, pav, 'unidade', (p * 100 + u)::text, u from generate_series(1, p_unidades) u;
    end loop;
  end loop;

  foreach area in array coalesce(p_areas_comuns, '{}') loop
    if trim(area) <> '' then
      k := k + 1;
      insert into public.locais (empreendimento_id, tipo, nome, ordem)
      values (emp, 'area_comum', trim(area), 1000 + k);
    end if;
  end loop;

  return emp;
end $$;

revoke execute on function public.pode_ver_empreendimento(uuid), public.pode_ver_inspecao(uuid),
  public.criar_empreendimento(text, text, integer, integer, integer, text[]) from public, anon;
grant execute on function public.pode_ver_empreendimento(uuid), public.pode_ver_inspecao(uuid),
  public.criar_empreendimento(text, text, integer, integer, integer, text[]) to authenticated;

-- ───────────────────────── foto do empreendimento ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('empreendimentos', 'empreendimentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy empreendimentos_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'empreendimentos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text);
create policy empreendimentos_fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'empreendimentos'
              and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
              and (select public.tem_papel('admin_empresa', 'engenheiro')));
create policy empreendimentos_fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'empreendimentos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and (select public.tem_papel('admin_empresa', 'engenheiro')));
