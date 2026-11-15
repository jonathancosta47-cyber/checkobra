-- Empreendimentos — parte 3: Ordens de Serviço passam a ficar no banco, ligadas a empresa,
-- empreendimento e (opcionalmente) local. Os campos da OS (cliente, serviço, checklist, fotos,
-- assinaturas) ficam em "dados", no mesmo formato que o app já usa.

create type public.status_os as enum ('aberta', 'em_andamento', 'concluida');

create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa_id() references public.empresas (id) on delete cascade,
  empreendimento_id uuid not null,
  local_id uuid,
  numero integer not null,
  status public.status_os not null default 'aberta',
  dados jsonb not null default '{}',
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  unique (empresa_id, numero),
  foreign key (empresa_id, empreendimento_id) references public.empreendimentos (empresa_id, id) on delete cascade,
  -- o local precisa ser do mesmo empreendimento; se o local for apagado a OS continua, sem local
  foreign key (empresa_id, empreendimento_id, local_id)
    references public.locais (empresa_id, empreendimento_id, id) on delete set null (local_id)
);
create index ordens_servico_empreendimento on public.ordens_servico (empresa_id, empreendimento_id, created_at desc);

create function public.numerar_os() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('ordens_servico:' || new.empresa_id::text));
  select coalesce(max(o.numero), 0) + 1 into new.numero
    from public.ordens_servico o where o.empresa_id = new.empresa_id;
  return new;
end $$;

create trigger ordens_servico_numero before insert on public.ordens_servico
  for each row execute function public.numerar_os();
create trigger ordens_servico_updated before update on public.ordens_servico
  for each row execute function public.tocar_updated_at();

revoke all on public.ordens_servico from anon, authenticated;
grant select, insert, update, delete on public.ordens_servico to authenticated;
grant all on public.ordens_servico to service_role;
alter table public.ordens_servico enable row level security;

-- vê e cria quem enxerga o empreendimento; edita quem criou, ou admin/engenheiro; apaga admin/engenheiro
create policy os_ver on public.ordens_servico for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));
create policy os_criar on public.ordens_servico for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and criado_por = (select auth.uid())
              and public.pode_ver_empreendimento(empreendimento_id));
create policy os_editar on public.ordens_servico for update to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id)
         and ((select public.tem_papel('admin_empresa', 'engenheiro')) or criado_por = (select auth.uid())))
  with check (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));
create policy os_apagar on public.ordens_servico for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')));

revoke execute on function public.numerar_os() from public, anon, authenticated;
