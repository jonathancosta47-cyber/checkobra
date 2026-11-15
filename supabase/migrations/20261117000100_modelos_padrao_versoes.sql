-- Configurações — parte 1: modelos de FVS com versões, modelos padrão do sistema e super admin.
--  • Modelo da empresa: empresa_id preenchido; só a própria empresa (admin/engenheiro) altera.
--  • Modelo padrão: empresa_id nulo; todas as empresas leem; só o super admin publica/altera.
--  • Editar cria uma NOVA VERSÃO (nova linha); a anterior fica guardada, e as FVS já feitas
--    continuam apontando para a versão que usaram.
--  • Escrever em modelos e itens só pelas funções salvar_modelo / duplicar_modelo
--    (e "ativo" por update direto), para ninguém editar uma versão já usada.

-- ───────────────────────── super admin (fora das empresas) ─────────────────────────

create table public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on public.super_admins from anon, authenticated;
grant select on public.super_admins to authenticated;
grant all on public.super_admins to service_role;
alter table public.super_admins enable row level security;
-- cada um só consegue ver a própria linha (para o app saber se mostra a área de modelos padrão)
create policy super_admins_proprio on public.super_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function public.sou_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid())
$$;

-- ───────────────────────── modelos: padrão, serviço e versões ─────────────────────────

alter table public.modelos_fvs alter column empresa_id drop not null;
alter table public.modelos_fvs alter column empresa_id drop default;
alter table public.modelos_fvs
  add column servico text not null default '',
  add column grupo_id uuid,
  add column atual boolean not null default true,
  add column criado_por uuid references auth.users (id) on delete set null;
update public.modelos_fvs set grupo_id = id;
alter table public.modelos_fvs alter column grupo_id set not null;
-- modelo novo sem grupo informado começa o próprio grupo (versão 1)
create function public.grupo_do_modelo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.grupo_id := coalesce(new.grupo_id, new.id);
  return new;
end $$;
create trigger modelos_fvs_grupo before insert on public.modelos_fvs
  for each row execute function public.grupo_do_modelo();
create unique index modelos_fvs_versao_unica on public.modelos_fvs (grupo_id, versao);
create unique index modelos_fvs_uma_atual on public.modelos_fvs (grupo_id) where atual;
create index modelos_fvs_padrao on public.modelos_fvs (nome) where empresa_id is null;

alter table public.modelo_itens alter column empresa_id drop not null;
alter table public.modelo_itens alter column empresa_id drop default;
alter table public.modelo_itens add column exige_foto boolean not null default false;
alter table public.respostas add column exige_foto boolean not null default false;

-- As ligações antigas exigiam modelo e inspeção da MESMA empresa (impossível com modelo padrão).
-- Viram ligações simples + checagens abaixo.
alter table public.modelo_itens drop constraint modelo_itens_empresa_id_modelo_id_fkey;
alter table public.modelo_itens add constraint modelo_itens_modelo_fk
  foreign key (modelo_id) references public.modelos_fvs (id) on delete cascade;
alter table public.inspecoes drop constraint inspecoes_empresa_id_modelo_id_fkey;
alter table public.inspecoes add constraint inspecoes_modelo_fk
  foreign key (modelo_id) references public.modelos_fvs (id);
alter table public.respostas drop constraint respostas_empresa_id_item_id_fkey;
alter table public.respostas add constraint respostas_item_fk
  foreign key (item_id) references public.modelo_itens (id) on delete set null;

-- item tem a mesma "dona" do modelo (empresa ou padrão)
create function public.validar_item_modelo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.empresa_id is distinct from (select m.empresa_id from public.modelos_fvs m where m.id = new.modelo_id) then
    raise exception 'O item precisa pertencer à mesma empresa do modelo' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger modelo_itens_dono before insert or update on public.modelo_itens
  for each row execute function public.validar_item_modelo();

-- FVS só com modelo da própria empresa ou padrão; ao criar, o modelo tem de estar ativo e na versão atual.
-- Depois de criada, a FVS não troca de modelo (guarda a versão usada).
create function public.validar_modelo_inspecao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  if tg_op = 'UPDATE' and new.modelo_id is distinct from old.modelo_id then
    raise exception 'A FVS não pode trocar de modelo' using errcode = '23514';
  end if;
  select empresa_id, ativo, atual into m from public.modelos_fvs where id = new.modelo_id;
  if not found or (m.empresa_id is not null and m.empresa_id <> new.empresa_id) then
    raise exception 'Modelo de FVS inválido para esta empresa' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' and (not m.ativo or not m.atual) then
    raise exception 'Use um modelo ativo, na versão atual' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger inspecoes_modelo_valido before insert or update of modelo_id on public.inspecoes
  for each row execute function public.validar_modelo_inspecao();

-- resposta só pode apontar para item do modelo da própria inspeção
create function public.validar_item_resposta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.item_id is not null and not exists (
    select 1 from public.modelo_itens i join public.inspecoes x on x.modelo_id = i.modelo_id
    where i.id = new.item_id and x.id = new.inspecao_id
  ) then
    raise exception 'O item não pertence ao modelo desta FVS' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger respostas_item_valido before insert or update of item_id on public.respostas
  for each row execute function public.validar_item_resposta();

-- ───────────────────────── permissões e RLS ─────────────────────────

drop policy modelos_fvs_ver on public.modelos_fvs;
drop policy modelos_fvs_criar on public.modelos_fvs;
drop policy modelos_fvs_editar on public.modelos_fvs;
drop policy modelos_fvs_apagar on public.modelos_fvs;
drop policy modelo_itens_ver on public.modelo_itens;
drop policy modelo_itens_criar on public.modelo_itens;
drop policy modelo_itens_editar on public.modelo_itens;
drop policy modelo_itens_apagar on public.modelo_itens;

-- escrever só pelas funções; o app pode apenas ler e ligar/desligar "ativo"
revoke insert, update, delete on public.modelos_fvs, public.modelo_itens from authenticated;
grant select on public.modelos_fvs, public.modelo_itens to authenticated;
grant update (ativo) on public.modelos_fvs to authenticated;

-- lê os da própria empresa e os padrão (só quem pertence a uma empresa); nunca os de outra empresa
create policy modelos_ver on public.modelos_fvs for select to authenticated
  using (empresa_id = (select public.minha_empresa_id())
         or (empresa_id is null and (select public.minha_empresa_id()) is not null));
create policy modelo_itens_ver on public.modelo_itens for select to authenticated
  using (empresa_id = (select public.minha_empresa_id())
         or (empresa_id is null and (select public.minha_empresa_id()) is not null));
-- ativar/desativar: admin/engenheiro nos da empresa; super admin nos padrão
create policy modelos_ativar on public.modelos_fvs for update to authenticated
  using ((empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')))
         or (empresa_id is null and (select public.sou_super_admin())))
  with check ((empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')))
              or (empresa_id is null and (select public.sou_super_admin())));

-- ───────────────────────── salvar (criar ou nova versão) e duplicar ─────────────────────────
-- p_itens: [{"texto": "...", "criterio": "...", "exige_foto": true}, ...] na ordem desejada.

create function public.salvar_modelo(
  p_modelo_id uuid,          -- null = modelo novo; senão, a versão ATUAL que está sendo editada
  p_nome text,
  p_servico text,
  p_itens jsonb,
  p_padrao boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  anterior public.modelos_fvs;
  v_empresa uuid;
  v_grupo uuid;
  v_versao integer := 1;
  v_ativo boolean := true;
  novo uuid := gen_random_uuid();
  item jsonb;
  k integer := 0;
begin
  if uid is null then
    raise exception 'É preciso estar logado' using errcode = '42501';
  end if;

  if p_modelo_id is null then
    v_empresa := case when p_padrao then null else public.minha_empresa_id() end;
    v_grupo := novo;
  else
    select * into anterior from public.modelos_fvs where id = p_modelo_id for update;
    if not found then
      raise exception 'Modelo não encontrado' using errcode = 'P0002';
    end if;
    if not anterior.atual then
      raise exception 'Edite a versão atual do modelo' using errcode = '23514';
    end if;
    v_empresa := anterior.empresa_id;
    v_grupo := anterior.grupo_id;
    v_versao := anterior.versao + 1;
    v_ativo := anterior.ativo;
  end if;

  -- quem pode: padrão → super admin; da empresa → admin/engenheiro da própria empresa
  if v_empresa is null then
    if not public.sou_super_admin() then
      raise exception 'Só o super admin altera modelos padrão' using errcode = '42501';
    end if;
  elsif v_empresa is distinct from public.minha_empresa_id() or not public.tem_papel('admin_empresa', 'engenheiro') then
    raise exception 'Só admin ou engenheiro da empresa altera os modelos dela' using errcode = '42501';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do modelo' using errcode = '23514';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O modelo precisa de ao menos um item' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(p_itens) e where coalesce(trim(e->>'texto'), '') = '') then
    raise exception 'Todo item precisa de descrição' using errcode = '23514';
  end if;

  if anterior.id is not null then
    update public.modelos_fvs set atual = false where id = anterior.id;
  end if;
  insert into public.modelos_fvs (id, empresa_id, nome, servico, descricao, versao, grupo_id, atual, ativo, criado_por)
  values (novo, v_empresa, trim(p_nome), coalesce(trim(p_servico), ''), coalesce(anterior.descricao, ''), v_versao, v_grupo, true, v_ativo, uid);

  for item in select * from jsonb_array_elements(p_itens) loop
    k := k + 1;
    insert into public.modelo_itens (empresa_id, modelo_id, ordem, texto, criterio, exige_foto)
    values (v_empresa, novo, k, trim(item->>'texto'), coalesce(trim(item->>'criterio'), ''), coalesce((item->>'exige_foto')::boolean, false));
  end loop;
  return novo;
end $$;

-- Copia um modelo (padrão ou da própria empresa) e seus itens para a empresa de quem chama.
create function public.duplicar_modelo(p_modelo_id uuid, p_nome text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  origem public.modelos_fvs;
  minha uuid := public.minha_empresa_id();
  novo uuid := gen_random_uuid();
begin
  if minha is null or not public.tem_papel('admin_empresa', 'engenheiro') then
    raise exception 'Só admin ou engenheiro da empresa duplica modelos' using errcode = '42501';
  end if;
  select * into origem from public.modelos_fvs where id = p_modelo_id;
  if not found or (origem.empresa_id is not null and origem.empresa_id <> minha) then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  insert into public.modelos_fvs (id, empresa_id, nome, servico, descricao, versao, grupo_id, atual, ativo, criado_por)
  values (novo, minha, coalesce(nullif(trim(p_nome), ''), origem.nome || ' (cópia)'), origem.servico, origem.descricao, 1, novo, true, true, auth.uid());
  insert into public.modelo_itens (empresa_id, modelo_id, ordem, texto, criterio, exige_foto)
  select minha, novo, i.ordem, i.texto, i.criterio, i.exige_foto from public.modelo_itens i where i.modelo_id = origem.id;
  return novo;
end $$;

revoke execute on function public.sou_super_admin(), public.salvar_modelo(uuid, text, text, jsonb, boolean),
  public.duplicar_modelo(uuid, text) from public, anon;
grant execute on function public.sou_super_admin(), public.salvar_modelo(uuid, text, text, jsonb, boolean),
  public.duplicar_modelo(uuid, text) to authenticated;
revoke execute on function public.validar_item_modelo(), public.validar_modelo_inspecao(), public.validar_item_resposta(), public.grupo_do_modelo()
  from public, anon, authenticated;

-- ───────────────────────── modelos padrão iniciais do sistema ─────────────────────────

do $$
declare
  modelos constant jsonb := '[
    {"nome": "Alvenaria de vedação", "servico": "Alvenaria", "itens": [
      ["Locação conforme projeto", "Desvio máx. 1 cm", false],
      ["Prumo e nível", "Prumo até 0,5 cm", true],
      ["Espessura das juntas", "Juntas de 1 a 2 cm", false],
      ["Amarração entre blocos", "Juntas desencontradas", false],
      ["Vergas e contravergas", "Apoio mín. 20 cm de cada lado", true]]},
    {"nome": "Contrapiso", "servico": "Contrapiso", "itens": [
      ["Limpeza da base", "Sem pó ou entulho", false],
      ["Nível e caimento", "Desnível até 0,5 cm; caimento para o ralo", true],
      ["Espessura conforme projeto", "Conforme projeto ±1 cm", false],
      ["Ausência de fissuras", "Sem fissuras visíveis", true],
      ["Cura adequada", "Mín. 7 dias úmido", false]]},
    {"nome": "Revestimento cerâmico", "servico": "Revestimento", "itens": [
      ["Base preparada", "Limpa, seca e regularizada", false],
      ["Argamassa colante", "Tipo conforme especificação; dupla colagem acima de 30×30 cm", false],
      ["Juntas", "Alinhadas e com espessura uniforme", true],
      ["Planicidade", "Sem dentes acima de 1 mm", false],
      ["Som cavo", "Nenhuma peça com som cavo", true]]}
  ]';
  m jsonb;
  it jsonb;
  novo uuid;
  k integer;
begin
  for m in select * from jsonb_array_elements(modelos) loop
    if exists (select 1 from public.modelos_fvs where empresa_id is null and nome = m->>'nome') then
      continue;
    end if;
    novo := gen_random_uuid();
    insert into public.modelos_fvs (id, empresa_id, nome, servico, descricao, versao, grupo_id, atual, ativo)
    values (novo, null, m->>'nome', m->>'servico', 'Modelo padrão CheckObra', 1, novo, true, true);
    k := 0;
    for it in select * from jsonb_array_elements(m->'itens') loop
      k := k + 1;
      insert into public.modelo_itens (empresa_id, modelo_id, ordem, texto, criterio, exige_foto)
      values (null, novo, k, it->>0, it->>1, (it->>2)::boolean);
    end loop;
  end loop;
end $$;
