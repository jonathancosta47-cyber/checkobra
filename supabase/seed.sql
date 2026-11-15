-- Dados de exemplo (fictícios) para testar o FVS multi-empresa.
-- Aplicar: npx supabase db push --remote --include-seed
-- Remover antes de publicar (apaga tudo dessas empresas em cascata):
--   delete from public.empresas where id in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');

insert into public.empresas (id, nome, cnpj) values
  ('a0000000-0000-4000-8000-000000000001', 'Construtora Horizonte (exemplo)', null),
  ('b0000000-0000-4000-8000-000000000002', 'Pedra Forte Engenharia (exemplo)', null)
on conflict (id) do nothing;

do $$
declare
  -- empresa, obra, endereço, nº de torres, pavimentos por torre, unidades por pavimento
  obras_exemplo constant jsonb := '[
    {"empresa": "a0000000-0000-4000-8000-000000000001", "nome": "Residencial Vista Verde",
     "endereco": "Rua das Palmeiras, 100 — São Paulo/SP", "torres": 2, "pavimentos": 3, "unidades": 4},
    {"empresa": "b0000000-0000-4000-8000-000000000002", "nome": "Edifício Jardins",
     "endereco": "Av. Central, 2500 — Belo Horizonte/MG", "torres": 1, "pavimentos": 4, "unidades": 2}
  ]';
  modelos_exemplo constant jsonb := '[
    {"nome": "Alvenaria de vedação", "itens": [
      ["Locação conforme projeto", "Desvio máx. 1 cm"],
      ["Prumo e nível", "Prumo até 0,5 cm"],
      ["Espessura das juntas", "Juntas de 1 a 2 cm"],
      ["Amarração entre blocos", "Juntas desencontradas"],
      ["Vergas e contravergas", "Apoio mín. 20 cm"]]},
    {"nome": "Contrapiso", "itens": [
      ["Limpeza da base", "Sem pó ou entulho"],
      ["Nível e caimento", "Desnível até 0,5 cm"],
      ["Espessura conforme projeto", "Conforme projeto ±1 cm"],
      ["Ausência de fissuras", "Sem fissuras visíveis"],
      ["Cura adequada", "Mín. 7 dias úmido"]]}
  ]';
  o jsonb; m jsonb; it jsonb;
  emp uuid; obra uuid; torre uuid; pav uuid; modelo uuid;
  t int; p int; u int; k int;
begin
  if exists (select 1 from public.obras where empresa_id in
             ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')) then
    raise notice 'Dados de exemplo já existem; nada a fazer.';
    return;
  end if;

  for o in select * from jsonb_array_elements(obras_exemplo) loop
    emp := (o->>'empresa')::uuid;
    insert into public.obras (empresa_id, nome, endereco)
    values (emp, o->>'nome', o->>'endereco') returning id into obra;

    for t in 1..(o->>'torres')::int loop
      insert into public.locais (empresa_id, obra_id, tipo, nome, ordem)
      values (emp, obra, 'torre', 'Torre ' || chr(64 + t), t) returning id into torre;
      for p in 1..(o->>'pavimentos')::int loop
        insert into public.locais (empresa_id, obra_id, pai_id, tipo, nome, ordem)
        values (emp, obra, torre, 'pavimento', p || 'º pavimento', p) returning id into pav;
        for u in 1..(o->>'unidades')::int loop
          insert into public.locais (empresa_id, obra_id, pai_id, tipo, nome, ordem)
          values (emp, obra, pav, 'unidade', 'Apto ' || p || lpad(u::text, 2, '0'), u);
        end loop;
      end loop;
    end loop;

    -- cada empresa recebe sua própria cópia dos 2 modelos de FVS
    for m in select * from jsonb_array_elements(modelos_exemplo) loop
      insert into public.modelos_fvs (empresa_id, nome, descricao)
      values (emp, m->>'nome', 'Modelo de exemplo') returning id into modelo;
      k := 0;
      for it in select * from jsonb_array_elements(m->'itens') loop
        k := k + 1;
        insert into public.modelo_itens (empresa_id, modelo_id, ordem, texto, criterio)
        values (emp, modelo, k, it->>0, it->>1);
      end loop;
    end loop;
  end loop;
end $$;

-- Para testar no app: crie seu usuário (Authentication > Users > Add user, "Auto Confirm User")
-- e rode no SQL Editor do Supabase, trocando o e-mail e o papel se quiser:
--
--   insert into public.perfis (id, empresa_id, nome, papel)
--   select id, 'a0000000-0000-4000-8000-000000000001', 'Seu nome', 'admin_empresa'
--   from auth.users where email = 'seu-email@exemplo.com';
