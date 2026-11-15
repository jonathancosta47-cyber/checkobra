// @vitest-environment node
// Empreendimentos como base de todos os módulos: isolamento entre empresas, liberação por inspetor,
// assistente de estrutura, OS no banco e migração das vistorias de entrega sem perda de dados.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { aplicarMigrations, asUser, createSupabaseDb, pgErrorCode } from "./supabase-stub";

const EMPRESA_A = "a0000000-0000-4000-8000-000000000001";
const EMPRESA_B = "b0000000-0000-4000-8000-000000000002";
const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const ENG_A = "22222222-2222-4222-8222-222222222222";
const INSP_A = "33333333-3333-4333-8333-333333333333";
const ADMIN_B = "44444444-4444-4444-8444-444444444444";

const count = async (tx: Transaction | PGlite, sql: string, params: unknown[] = []) =>
  Number((await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);
const one = async <T>(q: PGlite | Transaction, sql: string, params: unknown[] = []) => (await q.query<T>(sql, params)).rows[0]!;

let db: PGlite;
let empA = "";
let empB = "";
let empA2 = ""; // segundo empreendimento da empresa A, não liberado para o inspetor

beforeAll(async () => {
  db = await createSupabaseDb();
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ADMIN_A}', 'admin@a.exemplo', now()), ('${ENG_A}', 'eng@a.exemplo', now()),
      ('${INSP_A}', 'insp@a.exemplo', now()), ('${ADMIN_B}', 'admin@b.exemplo', now());
    insert into public.perfis (id, empresa_id, nome, papel) values
      ('${ADMIN_A}', '${EMPRESA_A}', 'Admin A', 'admin_empresa'),
      ('${ENG_A}', '${EMPRESA_A}', 'Eng A', 'engenheiro'),
      ('${INSP_A}', '${EMPRESA_A}', 'Insp A', 'inspetor'),
      ('${ADMIN_B}', '${EMPRESA_B}', 'Admin B', 'admin_empresa');
  `);
  empA = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_A])).id;
  empB = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_B])).id;
  empA2 = await asUser(db, ADMIN_A, async (tx) =>
    (await one<{ id: string }>(tx, "select public.criar_empreendimento('Condomínio Sol', 'Rua B, 2', 1, 2, 2, '{}') as id")).id,
  );
}, 60_000);

describe("isolamento: a empresa A não vê empreendimentos da empresa B", () => {
  it("cada empresa lista só os próprios empreendimentos", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      const { rows } = await tx.query<{ nome: string }>("select nome from empreendimentos order by nome");
      expect(rows.map((r) => r.nome)).toEqual(["Condomínio Sol", "Residencial Vista Verde"]);
      expect(await count(tx, "select 1 from empreendimentos where id = $1", [empB])).toBe(0);
      expect(await count(tx, "select 1 from locais where empreendimento_id = $1", [empB])).toBe(0);
    });
    await asUser(db, ADMIN_B, async (tx) => {
      const { rows } = await tx.query<{ nome: string }>("select nome from empreendimentos");
      expect(rows.map((r) => r.nome)).toEqual(["Edifício Jardins"]);
      expect(await count(tx, "select 1 from empreendimentos where id in ($1, $2)", [empA, empA2])).toBe(0);
    });
  });

  it("A não altera, apaga nem cria estrutura nos empreendimentos de B", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      expect((await tx.query("update empreendimentos set nome = 'X' where id = $1", [empB])).affectedRows).toBe(0);
      expect((await tx.query("delete from empreendimentos where id = $1", [empB])).affectedRows).toBe(0);
    });
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into locais (empreendimento_id, tipo, nome) values ($1, 'area_comum', 'Invasão')", [empB]))),
    ).toBe("23503");
    expect(await count(db, "select 1 from empreendimentos where id = $1 and nome = 'Edifício Jardins'", [empB])).toBe(1);
  });
});

describe("inspetor só vê empreendimentos liberados", () => {
  it("sem liberação não vê nada; com liberação vê só o liberado", async () => {
    await asUser(db, INSP_A, async (tx) => {
      expect(await count(tx, "select 1 from empreendimentos")).toBe(0);
      expect(await count(tx, "select 1 from locais")).toBe(0);
    });
    await asUser(db, ADMIN_A, (tx) => tx.query("insert into empreendimento_membros (empreendimento_id, perfil_id) values ($1, $2)", [empA, INSP_A]));
    await asUser(db, INSP_A, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select id from empreendimentos");
      expect(rows).toEqual([{ id: empA }]);
      expect(await count(tx, "select 1 from locais where empreendimento_id = $1", [empA2])).toBe(0);
      expect(await count(tx, "select 1 from locais where empreendimento_id = $1", [empA])).toBeGreaterThan(0);
    });
    // engenheiro vê todos da empresa, sem precisar de liberação
    await asUser(db, ENG_A, async (tx) => expect(await count(tx, "select 1 from empreendimentos")).toBe(2));
  });

  it("só o admin libera; inspetor não libera a si mesmo", async () => {
    expect(
      await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("insert into empreendimento_membros (empreendimento_id, perfil_id) values ($1, $2)", [empA2, INSP_A]))),
    ).toBe("42501");
    expect(
      await pgErrorCode(asUser(db, ENG_A, (tx) => tx.query("insert into empreendimento_membros (empreendimento_id, perfil_id) values ($1, $2)", [empA2, INSP_A]))),
    ).toBe("42501");
    // admin de A não libera empreendimento de B
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into empreendimento_membros (empreendimento_id, perfil_id) values ($1, $2)", [empB, INSP_A]))),
    ).toBe("23503");
  });

  it("inspetor não cria OS nem FVS em empreendimento não liberado", async () => {
    expect(
      await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("insert into ordens_servico (empreendimento_id, numero) values ($1, 0)", [empA2]))),
    ).toBe("42501");
  });
});

describe("assistente: criar_empreendimento gera a estrutura", () => {
  it("torres, pavimentos, unidades numeradas (101…1004) e áreas comuns", async () => {
    const id = await asUser(db, ENG_A, async (tx) =>
      (await one<{ id: string }>(tx, "select public.criar_empreendimento('Torres do Parque', 'Av. X, 10', 2, 10, 4, array['Salão de festas', ' ', 'Piscina']) as id")).id,
    );
    const tipos = await db.query<{ tipo: string; n: number }>(
      "select tipo::text, count(*)::int as n from locais where empreendimento_id = $1 group by tipo order by tipo",
      [id],
    );
    expect(tipos.rows).toEqual([
      { tipo: "area_comum", n: 2 },
      { tipo: "pavimento", n: 20 },
      { tipo: "torre", n: 2 },
      { tipo: "unidade", n: 80 },
    ]);
    const unidades = await db.query<{ nome: string }>(
      `select u.nome from locais u join locais p on p.id = u.pai_id join locais t on t.id = p.pai_id
       where u.empreendimento_id = $1 and t.nome = 'Torre A' order by p.ordem, u.ordem`,
      [id],
    );
    const nomes = unidades.rows.map((r) => r.nome);
    expect(nomes.slice(0, 4)).toEqual(["101", "102", "103", "104"]);
    expect(nomes.at(-1)).toBe("1004");
    expect(await count(db, "select 1 from locais where empreendimento_id = $1 and tipo = 'torre' and nome = 'Torre B'", [id])).toBe(1);
  });

  it("inspetor não cria empreendimento; parâmetros fora do limite são recusados", async () => {
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("select public.criar_empreendimento('X')")))).toBe("42501");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.criar_empreendimento('X', '', 1, 1, 150)")))).toBe("23514");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.criar_empreendimento('  ')")))).toBe("23514");
  });

  it("área comum fica na raiz, em torre ou pavimento; nunca dentro de unidade", async () => {
    const ids = await db.query<{ tipo: string; id: string }>(
      "select distinct on (tipo) tipo::text, id from locais where empreendimento_id = $1 order by tipo, ordem",
      [empA],
    );
    const de = Object.fromEntries(ids.rows.map((r) => [r.tipo, r.id]));
    await asUser(db, ADMIN_A, async (tx) => {
      await tx.query("insert into locais (empreendimento_id, tipo, nome) values ($1, 'area_comum', 'Portaria')", [empA]);
      await tx.query("insert into locais (empreendimento_id, pai_id, tipo, nome) values ($1, $2, 'area_comum', 'Hall')", [empA, de["pavimento"]]);
    });
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into locais (empreendimento_id, pai_id, tipo, nome) values ($1, $2, 'area_comum', 'X')", [empA, de["unidade"]]))),
    ).toBe("23514");
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into locais (empreendimento_id, pai_id, tipo, nome) values ($1, $2, 'torre', 'X')", [empA, de["torre"]]))),
    ).toBe("23514");
  });
});

describe("ordens de serviço no banco", () => {
  it("numeradas por empresa, invisíveis para outra empresa e presas ao empreendimento", async () => {
    const os = await asUser(db, ADMIN_A, (tx) =>
      one<{ id: string; numero: number; empresa_id: string }>(
        tx,
        "insert into ordens_servico (empreendimento_id, numero, dados) values ($1, 0, $2) returning id, numero, empresa_id",
        [empA, JSON.stringify({ client: { name: "Cliente" } })],
      ),
    );
    expect(os.numero).toBe(1);
    expect(os.empresa_id).toBe(EMPRESA_A);
    await asUser(db, ADMIN_B, async (tx) => {
      expect(await count(tx, "select 1 from ordens_servico")).toBe(0);
      expect((await tx.query("update ordens_servico set status = 'concluida' where id = $1", [os.id])).affectedRows).toBe(0);
    });
    // local de outro empreendimento não pode ser usado
    const localB = (await one<{ id: string }>(db, "select id from locais where empreendimento_id = $1 limit 1", [empB])).id;
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into ordens_servico (empreendimento_id, local_id, numero) values ($1, $2, 0)", [empA, localB]))),
    ).toBe("23503");
  });
});

describe("migração das vistorias de entrega (sem perder nada)", () => {
  it("cada vistoria ganha empresa, empreendimento e local; o conteúdo fica igual", async () => {
    const velho = await createSupabaseDb({ seed: false, ate: "20261116000400" });
    const DONO_SEM_EMPRESA = "55555555-5555-4555-8555-555555555555";
    const DONO_COM_EMPRESA = "66666666-6666-4666-8666-666666666666";
    const DONO_APAGADO = "77777777-7777-4777-8777-777777777777";
    await velho.exec(`
      insert into public.empresas (id, nome) values ('${EMPRESA_A}', 'Empresa A');
      insert into auth.users (id, email) values ('${DONO_SEM_EMPRESA}', 'antigo@exemplo.com'), ('${DONO_COM_EMPRESA}', 'membro@a.com');
      insert into public.perfis (id, empresa_id, papel) values ('${DONO_COM_EMPRESA}', '${EMPRESA_A}', 'engenheiro');
    `);
    const vistorias = [
      { owner: DONO_SEM_EMPRESA, data: { unit: { development: "Residencial Lago", tower: "Torre A", floor: "3", apartment: "302" }, rooms: [{ id: "r", name: "Sala", items: [] }], photos: ["data:image/png;base64,AAA"] } },
      { owner: DONO_SEM_EMPRESA, data: { unit: { development: "Residencial Lago", tower: "Torre A", floor: "3", apartment: "303" } } },
      { owner: DONO_COM_EMPRESA, data: { unit: { development: "  ", tower: "", floor: "", apartment: "" } } },
      { owner: DONO_APAGADO, data: { unit: { development: "Prédio Velho", tower: "", floor: "", apartment: "12" } } },
    ];
    const ids: string[] = [];
    for (const v of vistorias) {
      ids.push((await one<{ id: string }>(velho, "insert into delivery_inspections (owner_id, data) values ($1, $2) returning id", [v.owner, JSON.stringify(v.data)])).id);
    }

    await aplicarMigrations(velho, { desde: "20261116000400" });

    const linhas = await velho.query<{ id: string; data: unknown; empresa: string; empreendimento: string; local_id: string | null }>(`
      select d.id, d.data, e.nome as empresa, emp.nome as empreendimento, d.local_id
      from delivery_inspections d join empresas e on e.id = d.empresa_id join empreendimentos emp on emp.id = d.empreendimento_id
      order by d.created_at, d.id`);
    expect(linhas.rows).toHaveLength(4);
    const porId = new Map(linhas.rows.map((r) => [r.id, r]));
    // conteúdo intacto
    vistorias.forEach((v, k) => expect(porId.get(ids[k]!)!.data).toEqual(v.data));

    // dono sem empresa ganhou empresa própria e virou admin
    expect(porId.get(ids[0]!)!.empresa).toBe("Empresa de antigo@exemplo.com");
    expect(await one(velho, "select papel::text from perfis where id = $1", [DONO_SEM_EMPRESA])).toEqual({ papel: "admin_empresa" });
    // mesmo empreendimento para as duas vistorias do Residencial Lago, cada uma na sua unidade
    expect(porId.get(ids[0]!)!.empreendimento).toBe("Residencial Lago");
    expect(porId.get(ids[1]!)!.empreendimento).toBe("Residencial Lago");
    const caminho = async (localId: string) =>
      (await one<{ c: string }>(velho, `
        with recursive up as (select id, pai_id, nome, 0 as n from locais where id = $1
          union all select l.id, l.pai_id, l.nome, up.n + 1 from locais l join up on l.id = up.pai_id)
        select string_agg(nome, ' › ' order by n desc) as c from up`, [localId])).c;
    expect(await caminho(porId.get(ids[0]!)!.local_id!)).toBe("Torre A › 3º pavimento › 302");
    expect(await caminho(porId.get(ids[1]!)!.local_id!)).toBe("Torre A › 3º pavimento › 303");
    expect(await count(velho, "select 1 from locais where tipo = 'torre' and nome = 'Torre A'")).toBe(1);
    // sem empreendimento informado
    expect(porId.get(ids[2]!)!.empresa).toBe("Empresa A");
    expect(porId.get(ids[2]!)!.empreendimento).toBe("Empreendimento sem nome");
    expect(porId.get(ids[2]!)!.local_id).toBeNull();
    // dono que não existe mais no login
    expect(porId.get(ids[3]!)!.empresa).toBe("Vistorias sem dono (migração)");
    expect(await caminho(porId.get(ids[3]!)!.local_id!)).toBe("Torre única › Pavimento não informado › 12");

    // o dono antigo continua vendo as próprias vistorias
    await asUser(velho, DONO_SEM_EMPRESA, async (tx) => expect(await count(tx, "select 1 from delivery_inspections")).toBe(2));
    // e vistoria nova precisa de empreendimento
    expect(
      await pgErrorCode(asUser(velho, DONO_SEM_EMPRESA, (tx) => tx.query("insert into delivery_inspections (data) values ('{}')"))),
    ).toBe("23502");
  }, 60_000);
});
