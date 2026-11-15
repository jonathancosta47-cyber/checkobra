-- FVS multi-empresa — parte 1: tipos, tabelas e integridade.
-- Regra de ouro: toda tabela tem empresa_id e toda referência entre tabelas inclui
-- empresa_id na chave estrangeira, então é impossível ligar dados de empresas diferentes.
-- Apagar uma empresa apaga tudo dela (ON DELETE CASCADE), o que facilita limpar dados de exemplo.

create type public.papel_usuario as enum ('admin_empresa', 'engenheiro', 'inspetor');
create type public.tipo_local as enum ('torre', 'pavimento', 'unidade');
create type public.status_obra as enum ('ativa', 'pausada', 'concluida');
create type public.status_inspecao as enum ('rascunho', 'concluida', 'cancelada');
create type public.resultado_item as enum ('C', 'NC', 'NA');
create type public.status_nc as enum ('aberta', 'em_correcao', 'resolvida', 'verificada');

-- Atualiza updated_at automaticamente.
create function public.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── empresas e pessoas ─────────────────────────

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cnpj text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um perfil por usuário do Supabase Auth; cada usuário pertence a uma única empresa.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null default '',
  papel public.papel_usuario not null default 'inspetor',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);
create index perfis_empresa on public.perfis (empresa_id);

-- Convites: o admin cadastra o e-mail e o papel; a pessoa entra e aceita.
create table public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  papel public.papel_usuario not null default 'inspetor',
  criado_por uuid references auth.users (id) on delete set null,
  aceito_em timestamptz,
  created_at timestamptz not null default now(),
  unique (empresa_id, email)
);
create index convites_email_pendente on public.convites (email) where aceito_em is null;

-- ───────────────────────── obras e locais ─────────────────────────

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  endereco text not null default '',
  status public.status_obra not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);
create index obras_empresa on public.obras (empresa_id, nome);

-- Hierarquia torre > pavimento > unidade numa única tabela (pai_id).
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  pai_id uuid,
  tipo public.tipo_local not null,
  nome text not null check (length(trim(nome)) > 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, obra_id, id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade,
  foreign key (empresa_id, obra_id, pai_id) references public.locais (empresa_id, obra_id, id) on delete cascade,
  check ((tipo = 'torre') = (pai_id is null))
);
create index locais_obra_pai on public.locais (empresa_id, obra_id, pai_id, ordem);

-- Garante a ordem torre > pavimento > unidade (a FK acima já garante mesma obra e empresa).
create function public.validar_hierarquia_local() returns trigger
language plpgsql set search_path = '' as $$
declare
  tipo_pai public.tipo_local;
begin
  if new.pai_id is null then
    return new;
  end if;
  select l.tipo into tipo_pai from public.locais l where l.id = new.pai_id;
  if (new.tipo = 'pavimento' and tipo_pai is distinct from 'torre')
     or (new.tipo = 'unidade' and tipo_pai is distinct from 'pavimento') then
    raise exception 'Hierarquia inválida: % não pode ficar dentro de %', new.tipo, coalesce(tipo_pai::text, 'nada')
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger locais_hierarquia before insert or update of pai_id, tipo on public.locais
  for each row execute function public.validar_hierarquia_local();

-- ───────────────────────── modelos de FVS ─────────────────────────

create table public.modelos_fvs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  descricao text not null default '',
  versao integer not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);
create index modelos_empresa on public.modelos_fvs (empresa_id, nome);

create table public.modelo_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  modelo_id uuid not null,
  ordem integer not null default 0,
  texto text not null check (length(trim(texto)) > 0),
  criterio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, modelo_id) references public.modelos_fvs (empresa_id, id) on delete cascade
);
create index modelo_itens_modelo on public.modelo_itens (empresa_id, modelo_id, ordem);

-- ───────────────────────── inspeções ─────────────────────────

create table public.inspecoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero integer not null,
  obra_id uuid not null,
  local_id uuid not null,
  modelo_id uuid not null,
  inspetor_id uuid not null,
  status public.status_inspecao not null default 'rascunho',
  observacoes text not null default '',
  assinatura_path text,
  assinado_por text,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, numero),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade,
  -- o local precisa ser da mesma obra
  foreign key (empresa_id, obra_id, local_id) references public.locais (empresa_id, obra_id, id) on delete cascade,
  foreign key (empresa_id, modelo_id) references public.modelos_fvs (empresa_id, id),
  foreign key (empresa_id, inspetor_id) references public.perfis (empresa_id, id),
  check ((status = 'concluida') = (concluida_em is not null))
);
create index inspecoes_empresa_data on public.inspecoes (empresa_id, iniciada_em desc);
create index inspecoes_local on public.inspecoes (empresa_id, local_id);

-- Número sequencial por empresa (FVS #1, #2...), sem buracos por concorrência.
create function public.numerar_inspecao() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('inspecoes:' || new.empresa_id::text));
  select coalesce(max(i.numero), 0) + 1 into new.numero
    from public.inspecoes i where i.empresa_id = new.empresa_id;
  return new;
end $$;

create trigger inspecoes_numero before insert on public.inspecoes
  for each row execute function public.numerar_inspecao();

-- Respostas guardam uma cópia do texto e do critério: editar o modelo não altera inspeções antigas.
create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  inspecao_id uuid not null,
  item_id uuid,
  ordem integer not null default 0,
  texto text not null,
  criterio text not null default '',
  resultado public.resultado_item,
  observacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (inspecao_id, item_id),
  foreign key (empresa_id, inspecao_id) references public.inspecoes (empresa_id, id) on delete cascade,
  foreign key (empresa_id, item_id) references public.modelo_itens (empresa_id, id) on delete set null (item_id)
);
create index respostas_inspecao on public.respostas (empresa_id, inspecao_id, ordem);

create table public.nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  inspecao_id uuid not null,
  resposta_id uuid,
  descricao text not null check (length(trim(descricao)) > 0),
  responsavel text not null default '',
  prazo date,
  status public.status_nc not null default 'aberta',
  aberta_por uuid default auth.uid() references auth.users (id) on delete set null,
  resolvida_em timestamptz,
  verificada_por uuid references auth.users (id) on delete set null,
  verificada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, inspecao_id) references public.inspecoes (empresa_id, id) on delete cascade,
  foreign key (empresa_id, resposta_id) references public.respostas (empresa_id, id) on delete set null (resposta_id)
);
create index nc_empresa_status on public.nao_conformidades (empresa_id, status, prazo);
create index nc_inspecao on public.nao_conformidades (empresa_id, inspecao_id);

-- Fotos: o arquivo fica no Storage (bucket fvs-fotos, pasta = empresa_id); aqui fica o registro.
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  inspecao_id uuid not null,
  resposta_id uuid,
  nao_conformidade_id uuid,
  storage_path text not null unique,
  legenda text not null default '',
  enviada_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (empresa_id, inspecao_id) references public.inspecoes (empresa_id, id) on delete cascade,
  foreign key (empresa_id, resposta_id) references public.respostas (empresa_id, id) on delete cascade,
  foreign key (empresa_id, nao_conformidade_id) references public.nao_conformidades (empresa_id, id) on delete cascade,
  -- o arquivo tem que estar na pasta da própria empresa
  check (storage_path like empresa_id::text || '/%')
);
create index fotos_inspecao on public.fotos (empresa_id, inspecao_id);

-- updated_at automático
create trigger empresas_updated before update on public.empresas for each row execute function public.tocar_updated_at();
create trigger perfis_updated before update on public.perfis for each row execute function public.tocar_updated_at();
create trigger obras_updated before update on public.obras for each row execute function public.tocar_updated_at();
create trigger locais_updated before update on public.locais for each row execute function public.tocar_updated_at();
create trigger modelos_updated before update on public.modelos_fvs for each row execute function public.tocar_updated_at();
create trigger modelo_itens_updated before update on public.modelo_itens for each row execute function public.tocar_updated_at();
create trigger inspecoes_updated before update on public.inspecoes for each row execute function public.tocar_updated_at();
create trigger respostas_updated before update on public.respostas for each row execute function public.tocar_updated_at();
create trigger nc_updated before update on public.nao_conformidades for each row execute function public.tocar_updated_at();
