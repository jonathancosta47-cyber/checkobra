-- Configurações — parte 2: cadastro de empreiteiros e empreiteiro responsável na FVS.
-- Cada empresa só vê e altera os próprios empreiteiros.

create table public.empreiteiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa_id() references public.empresas (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'), -- só os 14 dígitos
  contato_nome text not null default '',
  telefone text not null default '',
  email text not null default '',
  servicos text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);
create unique index empreiteiros_cnpj_por_empresa on public.empreiteiros (empresa_id, cnpj) where cnpj is not null;
create index empreiteiros_empresa_nome on public.empreiteiros (empresa_id, nome);
create trigger empreiteiros_updated before update on public.empreiteiros
  for each row execute function public.tocar_updated_at();

revoke all on public.empreiteiros from anon, authenticated;
grant select, insert, update, delete on public.empreiteiros to authenticated;
grant all on public.empreiteiros to service_role;
alter table public.empreiteiros enable row level security;

-- todos da empresa veem (o inspetor escolhe o empreiteiro na FVS); admin/engenheiro cadastram; admin apaga
create policy empreiteiros_ver on public.empreiteiros for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()));
create policy empreiteiros_criar on public.empreiteiros for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')));
create policy empreiteiros_editar on public.empreiteiros for update to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')))
  with check (empresa_id = (select public.minha_empresa_id()));
create policy empreiteiros_apagar on public.empreiteiros for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));

-- FVS: empreiteiro responsável (da mesma empresa); se o empreiteiro for apagado, a FVS fica sem
alter table public.inspecoes add column empreiteiro_id uuid;
alter table public.inspecoes add constraint inspecoes_empreiteiro_fk
  foreign key (empresa_id, empreiteiro_id) references public.empreiteiros (empresa_id, id) on delete set null (empreiteiro_id);
create index inspecoes_empreiteiro on public.inspecoes (empresa_id, empreiteiro_id);
