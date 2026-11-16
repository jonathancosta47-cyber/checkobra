// @vitest-environment node
// Excluir FVS e editar empreendimento: quem pode, o que é apagado junto e isolamento entre empresas.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { asUser, createSupabaseDb, pgErrorCode } from "./supabase-stub";

const EMPRESA_A = "a0000000-0000-4000-8000-000000000001";
const EMPRESA_B = "b0000000-0000-4000-8000-000000000002";
const ENG_A = "22222222-2222-4222-8222-222222222222";
const INSP_A = "33333333-3333-4333-8333-333333333333";
const INSP2_A = "77777777-7777-4777-8777-777777777777";
const ADMIN_B = "44444444-4444-4444-8444-444444444444";

const count = async (tx: Transaction | PGlite, sql: string, params: unknown[] = []) =>
  Number((await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);
const one = async <T>(q: PGlite | Transaction, sql: string, params: unknown[] = []) => (await q.query<T>(sql, params)).rows[0]!;

let db: PGlite;
let empA = "";
let localA = "";
let padrao = "";

async function novaFvs(user: string) {
  return asUser(db, user, async (tx) => {
    const i = await one<{ id: string }>(tx, "insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0) returning id", [empA, localA, padrao]);
    await tx.query("insert into respostas (inspecao_id, item_id, ordem, texto, exige_foto) select $1, id, ordem, texto, exige_foto from modelo_itens where modelo_id = $2", [i.id, padrao]);
    const r = await one<{ id: string }>(tx, "select id from respostas where inspecao_id = $1 limit 1", [i.id]);
    await tx.query("insert into fvs_fotos (inspecao_id, resposta_id, empreendimento_id, storage_path) values ($1, $2, $3, $4)", [i.id, r.id, empA, `${EMPRESA_A}/${empA}/${i.id}/a.jpg`]);
    return i.id;
  });
}

beforeAll(async () => {
  db = await createSupabaseDb();
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ENG_A}', 'eng@a', now()), ('${INSP_A}', 'insp@a', now()), ('${INSP2_A}', 'insp2@a', now()), ('${ADMIN_B}', 'admin@b', now());
    insert into public.perfis (id, empresa_id, nome, papel) values
      ('${ENG_A}', '${EMPRESA_A}', 'Eng A', 'engenheiro'), ('${INSP_A}', '${EMPRESA_A}', 'Insp A', 'inspetor'),
      ('${INSP2_A}', '${EMPRESA_A}', 'Insp 2', 'inspetor'), ('${ADMIN_B}', '${EMPRESA_B}', 'Admin B', 'admin_empresa');
  `);
  empA = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_A])).id;
  localA = (await one<{ id: string }>(db, "select id from locais where empreendimento_id = $1 and tipo = 'unidade' limit 1", [empA])).id;
  padrao = (await one<{ id: string }>(db, "select id from modelos_fvs where empresa_id is null and nome = 'Contrapiso'")).id;
  for (const u of [INSP_A, INSP2_A]) {
    await db.query("insert into empreendimento_membros (empresa_id, empreendimento_id, perfil_id) values ($1, $2, $3)", [EMPRESA_A, empA, u]);
  }
}, 60_000);

describe("excluir FVS", () => {
  it("inspetor exclui a própria em rascunho; itens e fotos saem junto", async () => {
    const fvs = await novaFvs(INSP_A);
    await asUser(db, INSP_A, async (tx) => expect((await tx.query("delete from inspecoes where id = $1", [fvs])).affectedRows).toBe(1));
    expect(await count(db, "select 1 from respostas where inspecao_id = $1", [fvs])).toBe(0);
    expect(await count(db, "select 1 from fvs_fotos where inspecao_id = $1", [fvs])).toBe(0);
  });

  it("inspetor não exclui FVS de outro inspetor nem a própria concluída; engenheiro exclui", async () => {
    const deOutro = await novaFvs(INSP2_A);
    await asUser(db, INSP_A, async (tx) => expect((await tx.query("delete from inspecoes where id = $1", [deOutro])).affectedRows).toBe(0));
    const minha = await novaFvs(INSP_A);
    // concluir cumprindo as regras do banco (itens respondidos e assinatura do inspetor)
    await db.query("update respostas set resultado = 'NA' where inspecao_id = $1", [minha]);
    await db.query(
      `update inspecoes set status = 'concluida', concluida_em = now(),
         assinaturas = '[{"papel": "inspetor", "nome": "Insp A", "imagem": "data:image/png;base64,AAA"}]' where id = $1`,
      [minha],
    );
    await asUser(db, INSP_A, async (tx) => expect((await tx.query("delete from inspecoes where id = $1", [minha])).affectedRows).toBe(0));
    await asUser(db, ENG_A, async (tx) => expect((await tx.query("delete from inspecoes where id = $1", [minha])).affectedRows).toBe(1));
  });

  it("outra empresa não exclui", async () => {
    const fvs = await novaFvs(INSP_A);
    await asUser(db, ADMIN_B, async (tx) => expect((await tx.query("delete from inspecoes where id = $1", [fvs])).affectedRows).toBe(0));
    expect(await count(db, "select 1 from inspecoes where id = $1", [fvs])).toBe(1);
  });
});

describe("editar empreendimento", () => {
  it("engenheiro edita nome, endereço e status; inspetor e outra empresa não", async () => {
    await asUser(db, ENG_A, async (tx) =>
      expect((await tx.query("update empreendimentos set nome = 'Vista Verde II', endereco = 'Rua Nova, 1', status = 'pausada' where id = $1", [empA])).affectedRows).toBe(1),
    );
    expect(await one(db, "select nome, endereco, status::text from empreendimentos where id = $1", [empA])).toEqual({
      nome: "Vista Verde II",
      endereco: "Rua Nova, 1",
      status: "pausada",
    });
    await asUser(db, INSP_A, async (tx) => expect((await tx.query("update empreendimentos set nome = 'X' where id = $1", [empA])).affectedRows).toBe(0));
    await asUser(db, ADMIN_B, async (tx) => expect((await tx.query("update empreendimentos set nome = 'X' where id = $1", [empA])).affectedRows).toBe(0));
    expect(await pgErrorCode(asUser(db, ENG_A, (tx) => tx.query("update empreendimentos set nome = '  ' where id = $1", [empA])))).toBe("23514");
    expect(await one(db, "select nome from empreendimentos where id = $1", [empA])).toEqual({ nome: "Vista Verde II" });
  });
});
