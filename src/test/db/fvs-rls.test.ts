// @vitest-environment node
// Prova que uma empresa não vê nem altera dados de outra, e que os papéis funcionam.
// Roda as migrations reais de supabase/migrations num Postgres em memória (PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { asUser, createSupabaseDb, pgErrorCode } from "./supabase-stub";

const EMPRESA_A = "a0000000-0000-4000-8000-000000000001"; // Construtora Horizonte (exemplo)
const EMPRESA_B = "b0000000-0000-4000-8000-000000000002"; // Pedra Forte Engenharia (exemplo)
const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const INSPETOR_A = "22222222-2222-4222-8222-222222222222";
const ADMIN_B = "33333333-3333-4333-8333-333333333333";
const SEM_EMPRESA = "44444444-4444-4444-8444-444444444444";
const CONVIDADO = "55555555-5555-4555-8555-555555555555";

let db: PGlite;
const ids = { obraA: "", obraB: "", unidadeA: "", torreA: "", modeloA: "", modeloB: "", itemA: "" };

const count = async (tx: Transaction, sql: string, params: unknown[] = []) =>
  Number((await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);
const one = async <T>(q: PGlite | Transaction, sql: string, params: unknown[] = []) =>
  (await q.query<T>(sql, params)).rows[0]!;

beforeAll(async () => {
  db = await createSupabaseDb();
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ADMIN_A}', 'admin@horizonte.exemplo', now()),
      ('${INSPETOR_A}', 'inspetor@horizonte.exemplo', now()),
      ('${ADMIN_B}', 'admin@pedraforte.exemplo', now()),
      ('${SEM_EMPRESA}', 'novo@exemplo.com', now()),
      ('${CONVIDADO}', 'convidado@exemplo.com', null);
    insert into public.perfis (id, empresa_id, nome, papel) values
      ('${ADMIN_A}', '${EMPRESA_A}', 'Ana (admin A)', 'admin_empresa'),
      ('${INSPETOR_A}', '${EMPRESA_A}', 'Igor (inspetor A)', 'inspetor'),
      ('${ADMIN_B}', '${EMPRESA_B}', 'Bruno (admin B)', 'admin_empresa');
  `);
  const q = async (sql: string, empresa: string) => (await one<{ id: string }>(db, sql, [empresa])).id;
  ids.obraA = await q("select id from obras where empresa_id = $1", EMPRESA_A);
  ids.obraB = await q("select id from obras where empresa_id = $1", EMPRESA_B);
  ids.torreA = await q("select id from locais where empresa_id = $1 and tipo = 'torre' order by ordem", EMPRESA_A);
  ids.unidadeA = await q("select id from locais where empresa_id = $1 and tipo = 'unidade' order by nome", EMPRESA_A);
  ids.modeloA = await q("select id from modelos_fvs where empresa_id = $1 order by nome", EMPRESA_A);
  ids.modeloB = await q("select id from modelos_fvs where empresa_id = $1 order by nome", EMPRESA_B);
  ids.itemA = await q("select id from modelo_itens where empresa_id = $1 order by ordem", EMPRESA_A);
}, 60_000);

describe("estrutura", () => {
  it("todas as tabelas do schema public têm RLS ligado", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it("todas as tabelas do FVS têm empresa_id", async () => {
    const { rows } = await db.query<{ table_name: string }>(`
      select t.table_name from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and t.table_name not in ('empresas', 'delivery_inspections')
        and not exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'empresa_id')`);
    expect(rows).toEqual([]);
  });

  it("dados de exemplo: 2 empresas, cada uma com sua obra, locais e 2 modelos de FVS", async () => {
    const { rows } = await db.query<{ nome: string; locais: number; modelos: number; itens: number }>(`
      select e.nome,
        (select count(*)::int from locais l where l.empresa_id = e.id) as locais,
        (select count(*)::int from modelos_fvs m where m.empresa_id = e.id) as modelos,
        (select count(*)::int from modelo_itens i where i.empresa_id = e.id) as itens
      from empresas e order by e.nome`);
    expect(rows).toEqual([
      { nome: "Construtora Horizonte (exemplo)", locais: 2 + 6 + 24, modelos: 2, itens: 10 },
      { nome: "Pedra Forte Engenharia (exemplo)", locais: 1 + 4 + 8, modelos: 2, itens: 10 },
    ]);
  });
});

describe("isolamento: a empresa A não vê dados da empresa B", () => {
  it("cada admin enxerga só a própria empresa em todas as tabelas", async () => {
    for (const [user, empresa, locais] of [
      [ADMIN_A, EMPRESA_A, 32],
      [ADMIN_B, EMPRESA_B, 13],
    ] as const) {
      await asUser(db, user, async (tx) => {
        expect((await tx.query<{ id: string }>("select id from empresas")).rows).toEqual([{ id: empresa }]);
        expect(await count(tx, "select 1 from locais")).toBe(locais);
        expect(await count(tx, "select 1 from modelos_fvs")).toBe(2);
        for (const t of ["perfis", "obras", "locais", "modelos_fvs", "modelo_itens", "inspecoes", "respostas", "nao_conformidades", "fotos", "convites"]) {
          expect(await count(tx, `select 1 from ${t} where empresa_id <> $1`, [empresa]), t).toBe(0);
        }
      });
    }
  });

  it("A não encontra registros de B nem pelo id", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      expect(await count(tx, "select 1 from obras where id = $1", [ids.obraB])).toBe(0);
      expect(await count(tx, "select 1 from modelos_fvs where id = $1", [ids.modeloB])).toBe(0);
      expect(await count(tx, "select 1 from perfis where id = $1", [ADMIN_B])).toBe(0);
      expect(await count(tx, "select 1 from empresas where id = $1", [EMPRESA_B])).toBe(0);
    });
  });

  it("A não cria dados dentro da empresa B", async () => {
    const code = await pgErrorCode(
      asUser(db, ADMIN_A, (tx) => tx.query("insert into obras (empresa_id, nome) values ($1, 'Invasão')", [EMPRESA_B])),
    );
    expect(code).toBe("42501");
  });

  it("A não altera nem apaga dados de B (0 linhas afetadas)", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      expect((await tx.query("update obras set nome = 'Hackeada' where id = $1", [ids.obraB])).affectedRows).toBe(0);
      expect((await tx.query("delete from modelos_fvs where id = $1", [ids.modeloB])).affectedRows).toBe(0);
      expect((await tx.query("update empresas set nome = 'Hackeada' where id = $1", [EMPRESA_B])).affectedRows).toBe(0);
    });
    const obra = await one<{ nome: string }>(db, "select nome from obras where id = $1", [ids.obraB]);
    expect(obra.nome).toBe("Edifício Jardins");
    expect(await one<{ n: number }>(db, "select count(*)::int n from modelos_fvs where id = $1", [ids.modeloB])).toEqual({ n: 1 });
  });

  it("A não move os próprios dados para a empresa B", async () => {
    const code = await pgErrorCode(
      asUser(db, ADMIN_A, (tx) => tx.query("update obras set empresa_id = $1 where id = $2", [EMPRESA_B, ids.obraA])),
    );
    expect(code).toBe("42501");
  });

  it("A não liga seus dados a registros de B, mesmo sabendo o id", async () => {
    // local da empresa A dentro da obra de B
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_A, (tx) => tx.query("insert into locais (obra_id, tipo, nome) values ($1, 'torre', 'X')", [ids.obraB])),
      ),
    ).toBe("23503");
    // inspeção da empresa A usando o modelo de B
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_A, (tx) =>
          tx.query("insert into inspecoes (obra_id, local_id, modelo_id) values ($1, $2, $3)", [ids.obraA, ids.unidadeA, ids.modeloB]),
        ),
      ),
    ).toBe("23503");
  });

  it("inspeção de A fica invisível e intocável para B", async () => {
    const insp = await asUser(db, INSPETOR_A, (tx) =>
      one<{ id: string; numero: number }>(
        tx,
        "insert into inspecoes (obra_id, local_id, modelo_id) values ($1, $2, $3) returning id, numero",
        [ids.obraA, ids.unidadeA, ids.modeloA],
      ),
    );
    expect(insp.numero).toBe(1);
    await asUser(db, ADMIN_B, async (tx) => {
      expect(await count(tx, "select 1 from inspecoes where id = $1", [insp.id])).toBe(0);
      expect((await tx.query("update inspecoes set observacoes = 'x' where id = $1", [insp.id])).affectedRows).toBe(0);
    });
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_B, (tx) =>
          tx.query("insert into respostas (empresa_id, inspecao_id, texto) values ($1, $2, 'x')", [EMPRESA_A, insp.id]),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_B, (tx) =>
          tx.query("insert into nao_conformidades (inspecao_id, descricao) values ($1, 'x')", [insp.id]),
        ),
      ),
    ).not.toBeNull();
  });

  it("fotos: A não envia para a pasta de B nem vê arquivos de B", async () => {
    await asUser(db, ADMIN_A, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('fvs-fotos', $1)", [`${EMPRESA_A}/foto-a.jpg`]),
    );
    await asUser(db, ADMIN_B, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('fvs-fotos', $1)", [`${EMPRESA_B}/foto-b.jpg`]),
    );
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_A, (tx) =>
          tx.query("insert into storage.objects (bucket_id, name) values ('fvs-fotos', $1)", [`${EMPRESA_B}/invasao.jpg`]),
        ),
      ),
    ).toBe("42501");
    await asUser(db, ADMIN_A, async (tx) => {
      const { rows } = await tx.query<{ name: string }>("select name from storage.objects");
      expect(rows).toEqual([{ name: `${EMPRESA_A}/foto-a.jpg` }]);
    });
  });

  it("usuário sem empresa não vê nada; visitante sem login não tem acesso", async () => {
    await asUser(db, SEM_EMPRESA, async (tx) => {
      for (const t of ["empresas", "perfis", "obras", "locais", "modelos_fvs", "inspecoes"]) {
        expect(await count(tx, `select 1 from ${t}`), t).toBe(0);
      }
    });
    expect(await pgErrorCode(asUser(db, null, (tx) => tx.query("select * from obras")))).toBe("42501");
  });
});

describe("papéis", () => {
  it("inspetor não cadastra obra, local nem modelo", async () => {
    for (const sql of [
      "insert into obras (nome) values ('Nova')",
      `insert into locais (obra_id, tipo, nome) values ('${ids.obraA}', 'torre', 'Torre Z')`,
      "insert into modelos_fvs (nome) values ('Novo modelo')",
    ]) {
      expect(await pgErrorCode(asUser(db, INSPETOR_A, (tx) => tx.query(sql))), sql).toBe("42501");
    }
  });

  it("engenheiro/admin cadastra; o banco preenche a empresa sozinho", async () => {
    const obra = await asUser(db, ADMIN_A, (tx) =>
      one<{ empresa_id: string }>(tx, "insert into obras (nome) values ('Obra nova') returning empresa_id"),
    );
    expect(obra.empresa_id).toBe(EMPRESA_A);
  });

  it("inspetor não muda o próprio papel; admin não troca ninguém de empresa", async () => {
    expect(
      await pgErrorCode(asUser(db, INSPETOR_A, (tx) => tx.query("update perfis set papel = 'admin_empresa' where id = $1", [INSPETOR_A]))),
    ).toBe("42501");
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("update perfis set empresa_id = $1 where id = $2", [EMPRESA_B, INSPETOR_A]))),
    ).toBe("42501");
    await asUser(db, ADMIN_A, (tx) => tx.query("update perfis set papel = 'engenheiro' where id = $1", [INSPETOR_A]));
    expect(await one<{ papel: string }>(db, "select papel from perfis where id = $1", [INSPETOR_A])).toEqual({ papel: "engenheiro" });
    await db.query("update perfis set papel = 'inspetor' where id = $1", [INSPETOR_A]);
  });

  it("inspetor edita a própria inspeção só enquanto está em rascunho", async () => {
    const insp = await asUser(db, INSPETOR_A, async (tx) => {
      const i = await one<{ id: string }>(
        tx,
        "insert into inspecoes (obra_id, local_id, modelo_id) values ($1, $2, $3) returning id",
        [ids.obraA, ids.unidadeA, ids.modeloA],
      );
      await tx.query("insert into respostas (inspecao_id, item_id, texto, resultado) values ($1, $2, 'Prumo', 'NC')", [i.id, ids.itemA]);
      await tx.query("update inspecoes set status = 'concluida', concluida_em = now() where id = $1", [i.id]);
      return i;
    });
    await asUser(db, INSPETOR_A, async (tx) => {
      expect((await tx.query("update inspecoes set observacoes = 'depois' where id = $1", [insp.id])).affectedRows).toBe(0);
      expect((await tx.query("update respostas set resultado = 'C' where inspecao_id = $1", [insp.id])).affectedRows).toBe(0);
    });
    await asUser(db, ADMIN_A, async (tx) => {
      expect((await tx.query("update inspecoes set observacoes = 'revisada' where id = $1", [insp.id])).affectedRows).toBe(1);
    });
  });

  it("só admin/engenheiro verificam uma não conformidade", async () => {
    const nc = await asUser(db, INSPETOR_A, async (tx) => {
      const i = await one<{ id: string }>(
        tx,
        "insert into inspecoes (obra_id, local_id, modelo_id) values ($1, $2, $3) returning id",
        [ids.obraA, ids.unidadeA, ids.modeloA],
      );
      return one<{ id: string }>(tx, "insert into nao_conformidades (inspecao_id, descricao) values ($1, 'Junta fora do padrão') returning id", [i.id]);
    });
    expect(
      await pgErrorCode(asUser(db, INSPETOR_A, (tx) => tx.query("update nao_conformidades set status = 'verificada' where id = $1", [nc.id]))),
    ).toBe("42501");
    await asUser(db, ADMIN_A, (tx) => tx.query("update nao_conformidades set status = 'verificada' where id = $1", [nc.id]));
    const row = await one<{ verificada_por: string; resolvida_em: string | null }>(
      db,
      "select verificada_por, resolvida_em from nao_conformidades where id = $1",
      [nc.id],
    );
    expect(row.verificada_por).toBe(ADMIN_A);
    expect(row.resolvida_em).not.toBeNull();
  });
});

describe("regras de integridade e entrada na empresa", () => {
  it("hierarquia torre > pavimento > unidade é obrigatória", async () => {
    expect(
      await pgErrorCode(
        asUser(db, ADMIN_A, (tx) =>
          tx.query("insert into locais (obra_id, pai_id, tipo, nome) values ($1, $2, 'unidade', 'Apto solto')", [ids.obraA, ids.torreA]),
        ),
      ),
    ).toBe("23514");
  });

  it("criar_empresa: usuário novo cria a sua empresa, vira admin e começa vazio", async () => {
    const nova = await asUser(db, SEM_EMPRESA, async (tx) => {
      const { criar_empresa } = await one<{ criar_empresa: string }>(tx, "select public.criar_empresa('Minha Construtora', 'Nova Pessoa')");
      expect(await one(tx, "select public.meu_papel() as papel")).toEqual({ papel: "admin_empresa" });
      expect(await count(tx, "select 1 from obras")).toBe(0);
      return criar_empresa;
    });
    expect(nova).not.toBe(EMPRESA_A);
    expect(await pgErrorCode(asUser(db, SEM_EMPRESA, (tx) => tx.query("select public.criar_empresa('Outra')")))).toBe("23505");
  });

  it("aceitar_convite: só com e-mail confirmado, e entra com o papel do convite", async () => {
    await asUser(db, ADMIN_A, (tx) => tx.query("insert into convites (email, papel) values ('convidado@exemplo.com', 'engenheiro')"));
    expect(await pgErrorCode(asUser(db, CONVIDADO, (tx) => tx.query("select public.aceitar_convite()")))).toBe("42501");
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [CONVIDADO]);
    await asUser(db, CONVIDADO, async (tx) => {
      expect(await one(tx, "select public.aceitar_convite() as empresa")).toEqual({ empresa: EMPRESA_A });
      expect(await one(tx, "select public.meu_papel() as papel")).toEqual({ papel: "engenheiro" });
    });
    // o admin de B não vê convites de A
    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from convites")).toBe(0));
  });
});
