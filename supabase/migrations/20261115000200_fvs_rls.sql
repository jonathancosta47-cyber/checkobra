-- FVS multi-empresa — parte 2: quem pode ver e fazer o quê (RLS + papéis).
-- Toda política compara empresa_id com a empresa de quem está logado (minha_empresa_id()).
-- O app nunca envia empresa_id: o banco preenche sozinho.
-- As funções são "security definer" para ler perfis sem cair em recursão de RLS,
-- e são chamadas como (select ...) para o Postgres calcular uma vez por consulta.

-- ───────────────────────── funções auxiliares ─────────────────────────

create function public.minha_empresa_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.empresa_id from public.perfis p where p.id = auth.uid() and p.ativo
$$;

create function public.meu_papel() returns public.papel_usuario
language sql stable security definer set search_path = '' as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo
$$;

create function public.tem_papel(variadic papeis public.papel_usuario[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.papel = any (papeis) from public.perfis p where p.id = auth.uid() and p.ativo), false)
$$;

-- Admin e engenheiro editam qualquer inspeção da empresa; o inspetor só as próprias em rascunho.
create function public.pode_editar_inspecao(p_inspecao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.inspecoes i
    join public.perfis p on p.id = auth.uid() and p.ativo and p.empresa_id = i.empresa_id
    where i.id = p_inspecao
      and (p.papel in ('admin_empresa', 'engenheiro') or (i.inspetor_id = p.id and i.status = 'rascunho'))
  )
$$;

-- Ninguém troca de empresa; só o admin muda papel ou desativa alguém, e nunca a si mesmo
-- (evita a empresa ficar sem admin). Alterações feitas direto no banco (sem usuário logado) passam.
create function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id <> old.id or new.empresa_id <> old.empresa_id then
    raise exception 'Não é permitido mudar o usuário ou a empresa de um perfil' using errcode = '42501';
  end if;
  if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo then
    if not public.tem_papel('admin_empresa') then
      raise exception 'Só o admin da empresa altera papéis' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'O admin não pode alterar o próprio papel' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger perfis_proteger before update on public.perfis
  for each row execute function public.proteger_perfil();

-- Não conformidade: só admin/engenheiro marcam como verificada; datas preenchidas sozinhas.
create function public.regras_nao_conformidade() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'verificada' and auth.uid() is not null
       and not public.tem_papel('admin_empresa', 'engenheiro') then
      raise exception 'Só admin ou engenheiro verificam a correção' using errcode = '42501';
    end if;
    new.resolvida_em := case when new.status in ('resolvida', 'verificada') then coalesce(old.resolvida_em, now()) end;
    new.verificada_em := case when new.status = 'verificada' then now() end;
    new.verificada_por := case when new.status = 'verificada' then auth.uid() end;
  end if;
  return new;
end $$;

create trigger nc_regras before update on public.nao_conformidades
  for each row execute function public.regras_nao_conformidade();

-- ───────────────────────── valores padrão ─────────────────────────

alter table public.convites alter column empresa_id set default public.minha_empresa_id();
alter table public.convites alter column criado_por set default auth.uid();
alter table public.obras alter column empresa_id set default public.minha_empresa_id();
alter table public.locais alter column empresa_id set default public.minha_empresa_id();
alter table public.modelos_fvs alter column empresa_id set default public.minha_empresa_id();
alter table public.modelo_itens alter column empresa_id set default public.minha_empresa_id();
alter table public.inspecoes alter column empresa_id set default public.minha_empresa_id();
alter table public.inspecoes alter column inspetor_id set default auth.uid();
alter table public.respostas alter column empresa_id set default public.minha_empresa_id();
alter table public.nao_conformidades alter column empresa_id set default public.minha_empresa_id();
alter table public.fotos alter column empresa_id set default public.minha_empresa_id();

-- ───────────────────────── permissões de tabela ─────────────────────────
-- Visitantes sem login (anon) não acessam nada. Usuários logados passam pelas políticas abaixo.

revoke all on public.empresas, public.perfis, public.convites, public.obras, public.locais,
  public.modelos_fvs, public.modelo_itens, public.inspecoes, public.respostas,
  public.nao_conformidades, public.fotos from anon, authenticated;

grant select, update on public.empresas to authenticated;
grant select, update on public.perfis to authenticated;
grant select, insert, delete on public.convites to authenticated;
grant select, insert, update, delete on public.obras, public.locais, public.modelos_fvs,
  public.modelo_itens, public.inspecoes, public.respostas, public.nao_conformidades,
  public.fotos to authenticated;

grant all on public.empresas, public.perfis, public.convites, public.obras, public.locais,
  public.modelos_fvs, public.modelo_itens, public.inspecoes, public.respostas,
  public.nao_conformidades, public.fotos to service_role;

-- ───────────────────────── RLS ─────────────────────────

alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.convites enable row level security;
alter table public.obras enable row level security;
alter table public.locais enable row level security;
alter table public.modelos_fvs enable row level security;
alter table public.modelo_itens enable row level security;
alter table public.inspecoes enable row level security;
alter table public.respostas enable row level security;
alter table public.nao_conformidades enable row level security;
alter table public.fotos enable row level security;

-- empresas: vê a própria; só o admin edita. Criar empresa é pela função criar_empresa().
create policy empresas_ver on public.empresas for select to authenticated
  using (id = (select public.minha_empresa_id()));
create policy empresas_editar on public.empresas for update to authenticated
  using (id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')))
  with check (id = (select public.minha_empresa_id()));

-- perfis: vê os colegas; cada um edita o próprio nome; o admin edita os da empresa.
create policy perfis_ver on public.perfis for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()));
create policy perfis_editar_proprio on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and empresa_id = (select public.minha_empresa_id()));
create policy perfis_editar_admin on public.perfis for update to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')))
  with check (empresa_id = (select public.minha_empresa_id()));

-- convites: só o admin vê, cria e apaga.
create policy convites_admin_ver on public.convites for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));
create policy convites_admin_criar on public.convites for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));
create policy convites_admin_apagar on public.convites for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa')));

-- obras, locais, modelos e itens: todos da empresa veem; admin e engenheiro cadastram.
do $$
declare
  t text;
begin
  foreach t in array array['obras', 'locais', 'modelos_fvs', 'modelo_itens'] loop
    execute format(
      'create policy %1$s_ver on public.%1$I for select to authenticated
         using (empresa_id = (select public.minha_empresa_id()))', t);
    execute format(
      'create policy %1$s_criar on public.%1$I for insert to authenticated
         with check (empresa_id = (select public.minha_empresa_id())
                     and (select public.tem_papel(''admin_empresa'', ''engenheiro'')))', t);
    execute format(
      'create policy %1$s_editar on public.%1$I for update to authenticated
         using (empresa_id = (select public.minha_empresa_id())
                and (select public.tem_papel(''admin_empresa'', ''engenheiro'')))
         with check (empresa_id = (select public.minha_empresa_id()))', t);
    execute format(
      'create policy %1$s_apagar on public.%1$I for delete to authenticated
         using (empresa_id = (select public.minha_empresa_id())
                and (select public.tem_papel(''admin_empresa'', ''engenheiro'')))', t);
  end loop;
end $$;

-- inspeções: todos da empresa veem; qualquer papel abre uma inspeção em seu próprio nome.
create policy inspecoes_ver on public.inspecoes for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()));
create policy inspecoes_criar on public.inspecoes for insert to authenticated
  with check (empresa_id = (select public.minha_empresa_id()) and inspetor_id = (select auth.uid()));
create policy inspecoes_editar on public.inspecoes for update to authenticated
  using (public.pode_editar_inspecao(id))
  with check (
    empresa_id = (select public.minha_empresa_id())
    and ((select public.tem_papel('admin_empresa', 'engenheiro')) or inspetor_id = (select auth.uid()))
  );
create policy inspecoes_apagar on public.inspecoes for delete to authenticated
  using (
    empresa_id = (select public.minha_empresa_id())
    and ((select public.tem_papel('admin_empresa', 'engenheiro'))
         or (inspetor_id = (select auth.uid()) and status = 'rascunho'))
  );

-- respostas e fotos: seguem a inspeção (quem pode editar a inspeção, pode editar estes).
do $$
declare
  t text;
begin
  foreach t in array array['respostas', 'fotos'] loop
    execute format(
      'create policy %1$s_ver on public.%1$I for select to authenticated
         using (empresa_id = (select public.minha_empresa_id()))', t);
    execute format(
      'create policy %1$s_criar on public.%1$I for insert to authenticated
         with check (empresa_id = (select public.minha_empresa_id()) and public.pode_editar_inspecao(inspecao_id))', t);
    execute format(
      'create policy %1$s_editar on public.%1$I for update to authenticated
         using (public.pode_editar_inspecao(inspecao_id))
         with check (empresa_id = (select public.minha_empresa_id()) and public.pode_editar_inspecao(inspecao_id))', t);
    execute format(
      'create policy %1$s_apagar on public.%1$I for delete to authenticated
         using (public.pode_editar_inspecao(inspecao_id))', t);
  end loop;
end $$;

-- não conformidades: todos veem; quem pode editar a inspeção abre e atualiza;
-- admin/engenheiro também tratam NCs de inspeções já concluídas e apagam.
create policy nc_ver on public.nao_conformidades for select to authenticated
  using (empresa_id = (select public.minha_empresa_id()));
create policy nc_criar on public.nao_conformidades for insert to authenticated
  with check (
    empresa_id = (select public.minha_empresa_id())
    and ((select public.tem_papel('admin_empresa', 'engenheiro')) or public.pode_editar_inspecao(inspecao_id))
  );
create policy nc_editar on public.nao_conformidades for update to authenticated
  using (
    empresa_id = (select public.minha_empresa_id())
    and ((select public.tem_papel('admin_empresa', 'engenheiro')) or public.pode_editar_inspecao(inspecao_id))
  )
  with check (empresa_id = (select public.minha_empresa_id()));
create policy nc_apagar on public.nao_conformidades for delete to authenticated
  using (empresa_id = (select public.minha_empresa_id()) and (select public.tem_papel('admin_empresa', 'engenheiro')));

-- ───────────────────────── entrada na empresa ─────────────────────────

-- Quem acabou de criar conta e ainda não tem empresa cria a sua e vira admin.
create function public.criar_empresa(p_nome text, p_nome_usuario text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  nova uuid;
begin
  if uid is null then
    raise exception 'É preciso estar logado' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfis where id = uid) then
    raise exception 'Este usuário já pertence a uma empresa' using errcode = '23505';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da empresa' using errcode = '23514';
  end if;
  insert into public.empresas (nome) values (trim(p_nome)) returning id into nova;
  insert into public.perfis (id, empresa_id, nome, papel)
  values (uid, nova, coalesce(nullif(trim(p_nome_usuario), ''), ''), 'admin_empresa');
  return nova;
end $$;

-- Quem foi convidado entra na empresa do convite (exige e-mail confirmado,
-- para ninguém se cadastrar com o e-mail de outra pessoa e pegar o convite).
create function public.aceitar_convite(p_nome_usuario text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  meu_email text;
  c public.convites;
begin
  if uid is null then
    raise exception 'É preciso estar logado' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfis where id = uid) then
    raise exception 'Este usuário já pertence a uma empresa' using errcode = '23505';
  end if;
  select lower(u.email) into meu_email from auth.users u
   where u.id = uid and u.email_confirmed_at is not null;
  if meu_email is null then
    raise exception 'Confirme seu e-mail antes de aceitar o convite' using errcode = '42501';
  end if;
  select * into c from public.convites
   where email = meu_email and aceito_em is null
   order by created_at limit 1 for update;
  if not found then
    raise exception 'Nenhum convite pendente para este e-mail' using errcode = 'P0002';
  end if;
  insert into public.perfis (id, empresa_id, nome, papel)
  values (uid, c.empresa_id, coalesce(nullif(trim(p_nome_usuario), ''), ''), c.papel);
  update public.convites set aceito_em = now() where id = c.id;
  return c.empresa_id;
end $$;

-- Funções só para usuários logados (por padrão o Postgres libera para todos).
revoke execute on function public.minha_empresa_id(), public.meu_papel(),
  public.tem_papel(public.papel_usuario[]), public.pode_editar_inspecao(uuid),
  public.criar_empresa(text, text), public.aceitar_convite(text) from public, anon;
grant execute on function public.minha_empresa_id(), public.meu_papel(),
  public.tem_papel(public.papel_usuario[]), public.pode_editar_inspecao(uuid),
  public.criar_empresa(text, text), public.aceitar_convite(text) to authenticated;
revoke execute on function public.proteger_perfil(), public.regras_nao_conformidade(),
  public.validar_hierarquia_local(), public.numerar_inspecao(), public.tocar_updated_at() from public, anon, authenticated;
