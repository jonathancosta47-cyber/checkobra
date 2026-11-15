-- Dados de exemplo (fictícios) para testar o CheckObra multi-empresa.
-- Aplicar: npx supabase db push --remote --include-seed
-- Remover antes de publicar (apaga tudo dessas empresas em cascata):
--   delete from public.empresas where id in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');

insert into public.empresas (id, nome, cnpj) values
  ('a0000000-0000-4000-8000-000000000001', 'Construtora Horizonte (exemplo)', null),
  ('b0000000-0000-4000-8000-000000000002', 'Pedra Forte Engenharia (exemplo)', null)
on conflict (id) do nothing;

do $$
declare
  -- empresa, empreendimento, endereço, nº de torres, pavimentos por torre, unidades por pavimento, áreas comuns
  exemplos constant jsonb := '[
    {"empresa": "a0000000-0000-4000-8000-000000000001", "nome": "Residencial Vista Verde",
     "endereco": "Rua das Palmeiras, 100 — São Paulo/SP", "torres": 2, "pavimentos": 3, "unidades": 4,
     "areas": ["Salão de festas", "Piscina"]},
    {"empresa": "b0000000-0000-4000-8000-000000000002", "nome": "Edifício Jardins",
     "endereco": "Av. Central, 2500 — Belo Horizonte/MG", "torres": 1, "pavimentos": 4, "unidades": 2,
     "areas": ["Portaria"]}
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
  o jsonb; m jsonb; it jsonb; a text;
  emp_id uuid; empreendimento uuid; torre uuid; pav uuid; modelo uuid;
  t int; p int; k int;
begin
  if exists (select 1 from public.empreendimentos where empresa_id in
             ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')) then
    raise notice 'Dados de exemplo já existem; nada a fazer.';
    return;
  end if;

  for o in select * from jsonb_array_elements(exemplos) loop
    emp_id := (o->>'empresa')::uuid;
    insert into public.empreendimentos (empresa_id, nome, endereco)
    values (emp_id, o->>'nome', o->>'endereco') returning id into empreendimento;

    -- torres A, B...; pavimentos; unidades numeradas pavimento × 100 + unidade (101, 102...)
    for t in 1..(o->>'torres')::int loop
      insert into public.locais (empresa_id, empreendimento_id, tipo, nome, ordem)
      values (emp_id, empreendimento, 'torre', 'Torre ' || chr(64 + t), t) returning id into torre;
      for p in 1..(o->>'pavimentos')::int loop
        insert into public.locais (empresa_id, empreendimento_id, pai_id, tipo, nome, ordem)
        values (emp_id, empreendimento, torre, 'pavimento', p || 'º pavimento', p) returning id into pav;
        insert into public.locais (empresa_id, empreendimento_id, pai_id, tipo, nome, ordem)
        select emp_id, empreendimento, pav, 'unidade', (p * 100 + u)::text, u
        from generate_series(1, (o->>'unidades')::int) u;
      end loop;
    end loop;

    k := 0;
    for a in select * from jsonb_array_elements_text(o->'areas') loop
      k := k + 1;
      insert into public.locais (empresa_id, empreendimento_id, tipo, nome, ordem)
      values (emp_id, empreendimento, 'area_comum', a, 1000 + k);
    end loop;

    -- cada empresa recebe sua própria cópia dos 2 modelos de FVS
    for m in select * from jsonb_array_elements(modelos_exemplo) loop
      insert into public.modelos_fvs (empresa_id, nome, descricao)
      values (emp_id, m->>'nome', 'Modelo de exemplo') returning id into modelo;
      k := 0;
      for it in select * from jsonb_array_elements(m->'itens') loop
        k := k + 1;
        insert into public.modelo_itens (empresa_id, modelo_id, ordem, texto, criterio)
        values (emp_id, modelo, k, it->>0, it->>1);
      end loop;
    end loop;
  end loop;
end $$;

-- Empreiteiros de exemplo (2 por empresa)
insert into public.empreiteiros (empresa_id, nome, cnpj, contato_nome, telefone, servicos)
select v.empresa_id::uuid, v.nome, v.cnpj, v.contato, v.telefone, v.servicos
from (values
  ('a0000000-0000-4000-8000-000000000001', 'Alvenarias Silva (exemplo)', '11111111000111', 'Carlos Silva', '(11) 90000-0001', array['Alvenaria']),
  ('a0000000-0000-4000-8000-000000000001', 'Pisos & Cia (exemplo)', '22222222000122', 'Marta Souza', '(11) 90000-0002', array['Contrapiso', 'Revestimento']),
  ('b0000000-0000-4000-8000-000000000002', 'Construções Minas (exemplo)', '33333333000133', 'João Lima', '(31) 90000-0003', array['Alvenaria', 'Contrapiso']),
  ('b0000000-0000-4000-8000-000000000002', 'Revest BH (exemplo)', '44444444000144', 'Ana Prado', '(31) 90000-0004', array['Revestimento'])
) as v(empresa_id, nome, cnpj, contato, telefone, servicos)
where not exists (select 1 from public.empreiteiros e where e.empresa_id = v.empresa_id::uuid and e.cnpj = v.cnpj);

-- Para testar no app: crie seu usuário (Authentication > Users > Add user, "Auto Confirm User")
-- e rode no SQL Editor do Supabase, trocando o e-mail e o papel se quiser:
--
--   insert into public.perfis (id, empresa_id, nome, papel)
--   select id, 'a0000000-0000-4000-8000-000000000001', 'Seu nome', 'admin_empresa'
--   from auth.users where email = 'seu-email@exemplo.com';
--
-- Inspetor só vê empreendimentos liberados para ele (o admin libera em empreendimento_membros).
