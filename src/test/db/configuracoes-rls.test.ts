// @vitest-environment node
// Configurações: modelos de FVS (empresa × padrão do sistema, versões, duplicar) e empreiteiros.
// Prova que cada empresa só lê e escreve os próprios modelos e empreiteiros, lê os padrão
// e nunca vê dados de outra empresa.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { asUser, createSupabaseDb, pgErrorCode } from "./supabase-stub";

const EMPRESA_A = "a0000000-0000-4000-8000-000000000001";
const EMPRESA_B = "b0000000-0000-4000-8000-000000000002";
const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const ENG_A = "22222222-2222-4222-8222-222222222222";
const INSP_A = "33333333-3333-4333-8333-333333333333";
const ADMIN_B = "44444444-4444-4444-8444-444444444444";
const SUPER = "55555555-5555-4555-8555-555555555555";

const count = async (tx: Transaction | PGlite, sql: string, params: unknown[] = []) =>
  Number((await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);
const one = async <T>(q: PGlite | Transaction, sql: string, params: unknown[] = []) => (await q.query<T>(sql, params)).rows[0]!;
const itens = (...textos: string[]) => JSON.stringify(textos.map((t, k) => ({ texto: t, criterio: `critério ${k + 1}`, exige_foto: k === 0 })));

let db: PGlite;
let padrao = ""; // um modelo padrão do sistema (vem da migration)
let modeloB = "";
let empA = "";
let localA = "";

beforeAll(async () => {
  db = await createSupabaseDb();
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ADMIN_A}', 'admin@a', now()), ('${ENG_A}', 'eng@a', now()), ('${INSP_A}', 'insp@a', now()),
      ('${ADMIN_B}', 'admin@b', now()), ('${SUPER}', 'super@checkobra', now());
    insert into public.perfis (id, empresa_id, nome, papel) values
      ('${ADMIN_A}', '${EMPRESA_A}', 'Admin A', 'admin_empresa'), ('${ENG_A}', '${EMPRESA_A}', 'Eng A', 'engenheiro'),
      ('${INSP_A}', '${EMPRESA_A}', 'Insp A', 'inspetor'), ('${ADMIN_B}', '${EMPRESA_B}', 'Admin B', 'admin_empresa'),
      ('${SUPER}', '${EMPRESA_A}', 'Super', 'inspetor');
    insert into public.super_admins (user_id) values ('${SUPER}');
  `);
  padrao = (await one<{ id: string }>(db, "select id from modelos_fvs where empresa_id is null and nome = 'Alvenaria de vedação'")).id;
  modeloB = (await one<{ id: string }>(db, "select id from modelos_fvs where empresa_id = $1 limit 1", [EMPRESA_B])).id;
  empA = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_A])).id;
  localA = (await one<{ id: string }>(db, "select id from locais where empreendimento_id = $1 and tipo = 'unidade' limit 1", [empA])).id;
}, 60_000);

describe("modelos: cada empresa só vê os próprios e os padrão", () => {
  it("A vê os seus + os padrão; nunca os de B (nem os itens)", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      expect(await count(tx, "select 1 from modelos_fvs where empresa_id = $1", [EMPRESA_B])).toBe(0);
      expect(await count(tx, "select 1 from modelos_fvs where id = $1", [modeloB])).toBe(0);
      expect(await count(tx, "select 1 from modelo_itens where modelo_id = $1", [modeloB])).toBe(0);
      expect(await count(tx, "select 1 from modelos_fvs where empresa_id is null")).toBe(3);
      expect(await count(tx, "select 1 from modelo_itens where modelo_id = $1", [padrao])).toBe(5);
    });
    await asUser(db, ADMIN_B, async (tx) => {
      expect(await count(tx, "select 1 from modelos_fvs where empresa_id = $1", [EMPRESA_A])).toBe(0);
      expect(await count(tx, "select 1 from modelos_fvs where empresa_id is null")).toBe(3);
    });
  });

  it("ninguém escreve direto em modelos/itens; A não desativa modelo de B nem o padrão", async () => {
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into modelos_fvs (nome, versao) values ('X', 1)")))).toBe("42501");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("update modelo_itens set texto = 'X' where modelo_id = $1", [padrao])))).toBe("42501");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("delete from modelos_fvs where id = $1", [padrao])))).toBe("42501");
    await asUser(db, ADMIN_A, async (tx) => {
      expect((await tx.query("update modelos_fvs set ativo = false where id = $1", [modeloB])).affectedRows).toBe(0);
      expect((await tx.query("update modelos_fvs set ativo = false where id = $1", [padrao])).affectedRows).toBe(0);
    });
    expect(await one(db, "select ativo from modelos_fvs where id = $1", [padrao])).toEqual({ ativo: true });
  });

  it("A não salva nova versão nem duplica modelo de B", async () => {
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.salvar_modelo($1, 'X', '', $2::jsonb)", [modeloB, itens("a")])))).toBe("42501");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.duplicar_modelo($1)", [modeloB])))).toBe("P0002");
  });
});

describe("criar, editar (nova versão), duplicar e desativar", () => {
  it("engenheiro cria; inspetor não", async () => {
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("select public.salvar_modelo(null, 'X', '', $1::jsonb)", [itens("a")])))).toBe("42501");
    const id = await asUser(db, ENG_A, async (tx) =>
      (await one<{ id: string }>(tx, "select public.salvar_modelo(null, 'Pintura', 'Pintura', $1::jsonb) as id", [itens("Lixamento", "Demãos")])).id,
    );
    const m = await one<{ empresa_id: string; versao: number; atual: boolean }>(db, "select empresa_id, versao, atual from modelos_fvs where id = $1", [id]);
    expect(m).toEqual({ empresa_id: EMPRESA_A, versao: 1, atual: true });
    expect((await db.query("select texto, exige_foto from modelo_itens where modelo_id = $1 order by ordem", [id])).rows).toEqual([
      { texto: "Lixamento", exige_foto: true },
      { texto: "Demãos", exige_foto: false },
    ]);
    // B não enxerga
    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from modelos_fvs where id = $1", [id])).toBe(0));
  });

  it("editar cria a versão 2; a FVS feita com a versão 1 não muda", async () => {
    const v1 = await asUser(db, ADMIN_A, async (tx) =>
      (await one<{ id: string }>(tx, "select public.salvar_modelo(null, 'Gesso', 'Gesso', $1::jsonb) as id", [itens("Prumo", "Acabamento")])).id,
    );
    const fvs = await asUser(db, ADMIN_A, async (tx) => {
      const i = await one<{ id: string }>(tx, "insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0) returning id", [empA, localA, v1]);
      await tx.query(
        "insert into respostas (inspecao_id, item_id, ordem, texto, criterio) select $1, id, ordem, texto, criterio from modelo_itens where modelo_id = $2",
        [i.id, v1],
      );
      return i.id;
    });
    const v2 = await asUser(db, ENG_A, async (tx) =>
      (await one<{ id: string }>(tx, "select public.salvar_modelo($1, 'Gesso liso', 'Gesso', $2::jsonb) as id", [v1, itens("Prumo novo", "Acabamento", "Limpeza")])).id,
    );
    expect(v2).not.toBe(v1);
    const versoes = await db.query<{ id: string; versao: number; atual: boolean; nome: string }>(
      "select id, versao, atual, nome from modelos_fvs where grupo_id = (select grupo_id from modelos_fvs where id = $1) order by versao",
      [v1],
    );
    expect(versoes.rows.map((r) => [r.versao, r.atual, r.nome])).toEqual([
      [1, false, "Gesso"],
      [2, true, "Gesso liso"],
    ]);
    // a FVS continua na versão 1, com os itens da versão 1
    expect(await one(db, "select modelo_id from inspecoes where id = $1", [fvs])).toEqual({ modelo_id: v1 });
    expect((await db.query("select texto from respostas where inspecao_id = $1 order by ordem", [fvs])).rows.map((r: { texto: string }) => r.texto)).toEqual(["Prumo", "Acabamento"]);
    expect(await count(db, "select 1 from modelo_itens where modelo_id = $1", [v1])).toBe(2);
    // não dá para editar uma versão antiga, nem criar FVS nova com ela
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.salvar_modelo($1, 'X', '', $2::jsonb)", [v1, itens("a")])))).toBe("23514");
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0)", [empA, localA, v1]))),
    ).toBe("23514");
    // a FVS não troca de modelo depois de criada
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("update inspecoes set modelo_id = $1 where id = $2", [v2, fvs])))).toBe("23514");
  });

  it("duplicar o padrão para a minha empresa copia o modelo e os itens", async () => {
    const copia = await asUser(db, ENG_A, async (tx) => (await one<{ id: string }>(tx, "select public.duplicar_modelo($1) as id", [padrao])).id);
    const m = await one<{ empresa_id: string; nome: string; versao: number }>(db, "select empresa_id, nome, versao from modelos_fvs where id = $1", [copia]);
    expect(m).toEqual({ empresa_id: EMPRESA_A, nome: "Alvenaria de vedação (cópia)", versao: 1 });
    const de = (id: string) => db.query("select texto, criterio, exige_foto from modelo_itens where modelo_id = $1 order by ordem", [id]);
    expect((await de(copia)).rows).toEqual((await de(padrao)).rows);
    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from modelos_fvs where id = $1", [copia])).toBe(0));
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("select public.duplicar_modelo($1)", [padrao])))).toBe("42501");
  });

  it("modelo desativado não pode ser usado em FVS nova; padrão ativo pode", async () => {
    const id = await asUser(db, ADMIN_A, async (tx) =>
      (await one<{ id: string }>(tx, "select public.salvar_modelo(null, 'Forro', '', $1::jsonb) as id", [itens("a")])).id,
    );
    await asUser(db, ADMIN_A, (tx) => tx.query("update modelos_fvs set ativo = false where id = $1", [id]));
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0)", [empA, localA, id]))),
    ).toBe("23514");
    // FVS com modelo padrão funciona; com modelo de outra empresa, não
    await asUser(db, ADMIN_A, (tx) => tx.query("insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0)", [empA, localA, padrao]));
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0)", [empA, localA, modeloB]))),
    ).toBe("23503");
  });
});

describe("modelos padrão: só o super admin publica e altera", () => {
  it("empresa não cria nem edita padrão; super admin cria e todas as empresas leem", async () => {
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.salvar_modelo(null, 'X', '', $1::jsonb, true)", [itens("a")])))).toBe("42501");
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("select public.salvar_modelo($1, 'X', '', $2::jsonb)", [padrao, itens("a")])))).toBe("42501");
    const novo = await asUser(db, SUPER, async (tx) =>
      (await one<{ id: string }>(tx, "select public.salvar_modelo(null, 'Impermeabilização', 'Impermeabilização', $1::jsonb, true) as id", [itens("Teste de estanqueidade")])).id,
    );
    expect(await one(db, "select empresa_id from modelos_fvs where id = $1", [novo])).toEqual({ empresa_id: null });
    for (const u of [ADMIN_A, ADMIN_B]) {
      await asUser(db, u, async (tx) => expect(await count(tx, "select 1 from modelos_fvs where id = $1", [novo])).toBe(1));
    }
    // super admin desativa padrão; admin de empresa não
    await asUser(db, SUPER, async (tx) => expect((await tx.query("update modelos_fvs set ativo = false where id = $1", [novo])).affectedRows).toBe(1));
    // só o próprio super admin se enxerga na lista
    await asUser(db, ADMIN_A, async (tx) => expect(await count(tx, "select 1 from super_admins")).toBe(0));
    await asUser(db, SUPER, async (tx) => expect(await one(tx, "select public.sou_super_admin() as s")).toEqual({ s: true }));
  });
});

describe("empreiteiros: cada empresa só vê e altera os próprios", () => {
  it("A não vê nem altera empreiteiros de B; inspetor lê mas não cadastra", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      const { rows } = await tx.query<{ nome: string }>("select nome from empreiteiros order by nome");
      expect(rows.map((r) => r.nome)).toEqual(["Alvenarias Silva (exemplo)", "Pisos & Cia (exemplo)"]);
      expect((await tx.query("update empreiteiros set ativo = false where empresa_id = $1", [EMPRESA_B])).affectedRows).toBe(0);
    });
    expect(
      await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("insert into empreiteiros (empresa_id, nome) values ($1, 'Invasor')", [EMPRESA_B]))),
    ).toBe("42501");
    await asUser(db, INSP_A, async (tx) => expect(await count(tx, "select 1 from empreiteiros")).toBe(2));
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("insert into empreiteiros (nome) values ('X')")))).toBe("42501");
    // engenheiro cadastra; CNPJ só com 14 dígitos e sem repetir na empresa
    const novo = await asUser(db, ENG_A, (tx) => one<{ empresa_id: string }>(tx, "insert into empreiteiros (nome, cnpj, servicos) values ('Elétrica Já', '55555555000155', '{Elétrica}') returning empresa_id"));
    expect(novo.empresa_id).toBe(EMPRESA_A);
    expect(await pgErrorCode(asUser(db, ENG_A, (tx) => tx.query("insert into empreiteiros (nome, cnpj) values ('Dup', '55555555000155')")))).toBe("23505");
    expect(await pgErrorCode(asUser(db, ENG_A, (tx) => tx.query("insert into empreiteiros (nome, cnpj) values ('X', '12.345')")))).toBe("23514");
  });

  it("FVS só aceita empreiteiro da própria empresa", async () => {
    const empreiteiroB = (await one<{ id: string }>(db, "select id from empreiteiros where empresa_id = $1 limit 1", [EMPRESA_B])).id;
    const empreiteiroA = (await one<{ id: string }>(db, "select id from empreiteiros where empresa_id = $1 limit 1", [EMPRESA_A])).id;
    const fvs = await asUser(db, ADMIN_A, (tx) =>
      one<{ id: string }>(tx, "insert into inspecoes (empreendimento_id, local_id, modelo_id, numero, empreiteiro_id) values ($1, $2, $3, 0, $4) returning id", [empA, localA, padrao, empreiteiroA]),
    );
    expect(await pgErrorCode(asUser(db, ADMIN_A, (tx) => tx.query("update inspecoes set empreiteiro_id = $1 where id = $2", [empreiteiroB, fvs.id])))).toBe("23503");
  });
});
