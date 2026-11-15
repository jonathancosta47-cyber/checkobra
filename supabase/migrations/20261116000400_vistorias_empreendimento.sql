-- Empreendimentos — parte 4: vistorias de entrega passam a ter empresa, empreendimento e local.
-- Migra as vistorias existentes sem apagar nada: o conteúdo (coluna data) fica intacto.
--  • dono sem empresa → ganha uma empresa própria e vira admin dela (ninguém perde acesso)
--  • empreendimento ← data.unit.development (cria se não existir; "Empreendimento sem nome" se vazio)
--  • local ← data.unit.tower › floor › apartment (cria a torre, o pavimento e a unidade que faltarem)

alter table public.delivery_inspections
  add column empresa_id uuid references public.empresas (id) on delete cascade,
  add column empreendimento_id uuid,
  add column local_id uuid;

-- acha ou cria um local filho (usado só nesta migração)
create function pg_temp.local_filho(p_empresa uuid, p_emp uuid, p_pai uuid, p_tipo public.tipo_local, p_nome text)
returns uuid language plpgsql as $$
declare
  achado uuid;
begin
  select l.id into achado from public.locais l
   where l.empresa_id = p_empresa and l.empreendimento_id = p_emp and l.tipo = p_tipo and l.nome = p_nome
     and l.pai_id is not distinct from p_pai
   order by l.created_at limit 1;
  if achado is null then
    insert into public.locais (empresa_id, empreendimento_id, pai_id, tipo, nome,
      ordem) values (p_empresa, p_emp, p_pai, p_tipo, p_nome,
      coalesce(nullif(left(regexp_replace(p_nome, '\D', '', 'g'), 6), '')::integer, 0))
    returning id into achado;
  end if;
  return achado;
end $$;

do $$
declare
  r record;
  v_empresa uuid;
  v_emp uuid;
  v_torre uuid;
  v_pav uuid;
  v_unid uuid;
  v_email text;
  nome_emp text;
  nome_torre text;
  nome_pav text;
  nome_apto text;
begin
  -- 1) donos que ainda não têm empresa ganham uma (e viram admin dela)
  for r in
    select distinct d.owner_id from public.delivery_inspections d
    join auth.users u on u.id = d.owner_id
    where not exists (select 1 from public.perfis p where p.id = d.owner_id)
  loop
    select u.email into v_email from auth.users u where u.id = r.owner_id;
    insert into public.empresas (nome) values ('Empresa de ' || coalesce(v_email, 'usuário')) returning id into v_empresa;
    insert into public.perfis (id, empresa_id, nome, papel) values (r.owner_id, v_empresa, '', 'admin_empresa');
  end loop;

  -- 2) cada vistoria vai para o seu empreendimento e local
  for r in
    select d.id, d.data, p.empresa_id
    from public.delivery_inspections d
    left join public.perfis p on p.id = d.owner_id
  loop
    v_empresa := r.empresa_id;
    if v_empresa is null then
      -- dono que não existe mais no login: guarda numa empresa à parte, sem perder a vistoria
      select e.id into v_empresa from public.empresas e where e.nome = 'Vistorias sem dono (migração)';
      if v_empresa is null then
        insert into public.empresas (nome) values ('Vistorias sem dono (migração)') returning id into v_empresa;
      end if;
    end if;

    nome_emp := coalesce(nullif(trim(r.data->'unit'->>'development'), ''), 'Empreendimento sem nome');
    select e.id into v_emp from public.empreendimentos e
     where e.empresa_id = v_empresa and e.nome = nome_emp order by e.created_at limit 1;
    if v_emp is null then
      insert into public.empreendimentos (empresa_id, nome) values (v_empresa, nome_emp) returning id into v_emp;
    end if;

    nome_torre := nullif(trim(r.data->'unit'->>'tower'), '');
    nome_pav := nullif(trim(r.data->'unit'->>'floor'), '');
    nome_apto := nullif(trim(r.data->'unit'->>'apartment'), '');
    v_torre := null; v_pav := null; v_unid := null;

    if nome_torre is not null or nome_pav is not null or nome_apto is not null then
      v_torre := pg_temp.local_filho(v_empresa, v_emp, null, 'torre', coalesce(nome_torre, 'Torre única'));
      if nome_pav is not null or nome_apto is not null then
        v_pav := pg_temp.local_filho(v_empresa, v_emp, v_torre, 'pavimento',
          case when nome_pav ~ '^\d+$' then nome_pav || 'º pavimento' else coalesce(nome_pav, 'Pavimento não informado') end);
        if nome_apto is not null then
          v_unid := pg_temp.local_filho(v_empresa, v_emp, v_pav, 'unidade', nome_apto);
        end if;
      end if;
    end if;

    update public.delivery_inspections
       set empresa_id = v_empresa, empreendimento_id = v_emp, local_id = coalesce(v_unid, v_pav, v_torre)
     where id = r.id;
  end loop;
end $$;

alter table public.delivery_inspections
  alter column empresa_id set default public.minha_empresa_id(),
  alter column empresa_id set not null,
  alter column empreendimento_id set not null,
  add constraint delivery_inspections_empreendimento_fk foreign key (empresa_id, empreendimento_id)
    references public.empreendimentos (empresa_id, id) on delete cascade,
  add constraint delivery_inspections_local_fk foreign key (empresa_id, empreendimento_id, local_id)
    references public.locais (empresa_id, empreendimento_id, id) on delete set null (local_id);
create index delivery_inspections_empreendimento on public.delivery_inspections (empresa_id, empreendimento_id, created_at desc);

-- RLS: deixa de ser "só o dono" e passa a ser por empresa + empreendimento visível
drop policy "Owners read deliveries" on public.delivery_inspections;
drop policy "Owners create deliveries" on public.delivery_inspections;
drop policy "Owners update deliveries" on public.delivery_inspections;
drop policy "Owners delete deliveries" on public.delivery_inspections;

create policy vistorias_ver on public.delivery_inspections for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));
create policy vistorias_criar on public.delivery_inspections for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and owner_id = (select auth.uid())
              and public.pode_ver_empreendimento(empreendimento_id));
create policy vistorias_editar on public.delivery_inspections for update to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id)
         and ((select public.tem_papel('admin_empresa', 'engenheiro')) or owner_id = (select auth.uid())))
  with check (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id));
create policy vistorias_apagar on public.delivery_inspections for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and public.pode_ver_empreendimento(empreendimento_id)
         and ((select public.tem_papel('admin_empresa', 'engenheiro')) or owner_id = (select auth.uid())));
