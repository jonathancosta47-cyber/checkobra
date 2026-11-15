// @vitest-environment node
// FVS: fotos por item (tabela fvs_fotos + Storage), regras para concluir e PDF salvo.
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { asUser, createSupabaseDb, pgErrorCode } from "./supabase-stub";

const EMPRESA_A = "a0000000-0000-4000-8000-000000000001";
const EMPRESA_B = "b0000000-0000-4000-8000-000000000002";
const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const INSP_A = "33333333-3333-4333-8333-333333333333";
const INSP_SEM = "66666666-6666-4666-8666-666666666666"; // inspetor de A sem liberação no empreendimento
const ADMIN_B = "44444444-4444-4444-8444-444444444444";
const ASSINATURA = JSON.stringify([{ papel: "inspetor", nome: "Insp A", imagem: "data:image/png;base64,AAA" }]);

const count = async (tx: Transaction | PGlite, sql: string, params: unknown[] = []) =>
  Number((await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n);
const one = async <T>(q: PGlite | Transaction, sql: string, params: unknown[] = []) => (await q.query<T>(sql, params)).rows[0]!;

let db: PGlite;
let empA = "";
let empB = "";
let localA = "";
let padrao = ""; // Alvenaria de vedação: itens 2 e 5 exigem foto

// Cria uma FVS (como o inspetor) com os itens do modelo padrão copiados.
async function novaFvs(user = INSP_A) {
  return asUser(db, user, async (tx) => {
    const i = await one<{ id: string }>(tx, "insert into inspecoes (empreendimento_id, local_id, modelo_id, numero) values ($1, $2, $3, 0) returning id", [empA, localA, padrao]);
    await tx.query(
      "insert into respostas (inspecao_id, item_id, ordem, texto, criterio, exige_foto) select $1, id, ordem, texto, criterio, exige_foto from modelo_itens where modelo_id = $2",
      [i.id, padrao],
    );
    return i.id;
  });
}
const respostas = (fvs: string) => db.query<{ id: string; exige_foto: boolean }>("select id, exige_foto from respostas where inspecao_id = $1 order by ordem", [fvs]);
const caminho = (fvs: string, arquivo = "a.jpg", emp = empA, empresa = EMPRESA_A) => `${empresa}/${emp}/${fvs}/${arquivo}`;

beforeAll(async () => {
  db = await createSupabaseDb();
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ADMIN_A}', 'admin@a', now()), ('${INSP_A}', 'insp@a', now()), ('${INSP_SEM}', 'insp2@a', now()), ('${ADMIN_B}', 'admin@b', now());
    insert into public.perfis (id, empresa_id, nome, papel) values
      ('${ADMIN_A}', '${EMPRESA_A}', 'Admin A', 'admin_empresa'), ('${INSP_A}', '${EMPRESA_A}', 'Insp A', 'inspetor'),
      ('${INSP_SEM}', '${EMPRESA_A}', 'Insp sem', 'inspetor'), ('${ADMIN_B}', '${EMPRESA_B}', 'Admin B', 'admin_empresa');
  `);
  empA = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_A])).id;
  empB = (await one<{ id: string }>(db, "select id from empreendimentos where empresa_id = $1", [EMPRESA_B])).id;
  localA = (await one<{ id: string }>(db, "select id from locais where empreendimento_id = $1 and tipo = 'unidade' limit 1", [empA])).id;
  padrao = (await one<{ id: string }>(db, "select id from modelos_fvs where empresa_id is null and nome = 'Alvenaria de vedação'")).id;
  await db.query("insert into empreendimento_membros (empresa_id, empreendimento_id, perfil_id) values ($1, $2, $3)", [EMPRESA_A, empA, INSP_A]);
}, 60_000);

describe("fotos da FVS (tabela fvs_fotos)", () => {
  it("foto fica ligada ao item; outra empresa não vê", async () => {
    const fvs = await novaFvs();
    const r = (await respostas(fvs)).rows[0]!;
    await asUser(db, INSP_A, (tx) =>
      tx.query("insert into fvs_fotos (inspecao_id, resposta_id, empreendimento_id, storage_path) values ($1, $2, $3, $4)", [fvs, r.id, empA, caminho(fvs, "1.jpg")]),
    );
    await asUser(db, INSP_A, async (tx) => expect(await count(tx, "select 1 from fvs_fotos where inspecao_id = $1", [fvs])).toBe(1));
    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from fvs_fotos")).toBe(0));
  });

  it("recusa foto de item de outra FVS, de outro empreendimento ou fora da pasta certa", async () => {
    const fvs1 = await novaFvs();
    const fvs2 = await novaFvs();
    const deOutra = (await respostas(fvs2)).rows[0]!.id;
    const minha = (await respostas(fvs1)).rows[0]!.id;
    const inserir = (resposta: string, emp: string, path: string) =>
      pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("insert into fvs_fotos (inspecao_id, resposta_id, empreendimento_id, storage_path) values ($1, $2, $3, $4)", [fvs1, resposta, emp, path])));
    expect(await inserir(deOutra, empA, caminho(fvs1, "x.jpg"))).toBe("23514");
    expect(await inserir(minha, empB, caminho(fvs1, "y.jpg", empB))).not.toBeNull();
    expect(await inserir(minha, empA, `${EMPRESA_A}/outra-pasta/z.jpg`)).toBe("23514");
  });
});

describe("arquivos no Storage (bucket fvs-fotos)", () => {
  const enviar = (user: string, path: string, bucket = "fvs-fotos") =>
    pgErrorCode(asUser(db, user, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, path])));

  it("envia só para a pasta empresa/empreendimento/FVS de uma FVS que pode editar", async () => {
    const fvs = await novaFvs();
    expect(await enviar(INSP_A, caminho(fvs, "ok.jpg"))).toBeNull();
    expect(await enviar(INSP_A, `${EMPRESA_A}/${empA}/solta.jpg`)).toBe("42501"); // sem pasta da FVS
    expect(await enviar(INSP_A, caminho(fvs, "b.jpg", empA, EMPRESA_B))).toBe("42501"); // pasta de outra empresa
    expect(await enviar(INSP_A, caminho(fvs, "c.jpg", empB))).toBe("42501"); // empreendimento errado
    expect(await enviar(INSP_SEM, caminho(fvs, "d.jpg"))).toBe("42501"); // inspetor sem liberação
    expect(await enviar(ADMIN_B, caminho(fvs, "e.jpg"))).toBe("42501"); // outra empresa
    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from storage.objects where bucket_id = 'fvs-fotos'")).toBe(0));
    await asUser(db, INSP_A, async (tx) => expect(await count(tx, "select 1 from storage.objects where name = $1", [caminho(fvs, "ok.jpg")])).toBe(1));
  });
});

describe("concluir a FVS: o banco confere as regras", () => {
  const concluir = (fvs: string, assinaturas = ASSINATURA) =>
    pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("update inspecoes set status = 'concluida', concluida_em = now(), assinaturas = $2 where id = $1", [fvs, assinaturas])));
  const responderTudo = (fvs: string, resultado = "C") => db.query("update respostas set resultado = $2 where inspecao_id = $1", [fvs, resultado]);

  it("exige itens respondidos, NC descrita, foto onde o modelo exige e assinatura do inspetor", async () => {
    const fvs = await novaFvs();
    expect(await concluir(fvs)).toBe("23514"); // itens sem resposta
    await responderTudo(fvs);
    expect(await concluir(fvs)).toBe("23514"); // itens 2 e 5 exigem foto
    const exigem = (await respostas(fvs)).rows.filter((r) => r.exige_foto);
    expect(exigem).toHaveLength(2);
    for (const [k, r] of exigem.entries()) {
      await asUser(db, INSP_A, (tx) =>
        tx.query("insert into fvs_fotos (inspecao_id, resposta_id, empreendimento_id, storage_path) values ($1, $2, $3, $4)", [fvs, r.id, empA, caminho(fvs, `f${k}.jpg`)]),
      );
    }
    expect(await concluir(fvs, "[]")).toBe("23514"); // sem assinatura
    expect(await concluir(fvs, JSON.stringify([{ papel: "inspetor", nome: "X", imagem: "" }]))).toBe("23514");
    expect(await concluir(fvs)).toBeNull();
  });

  it("item N/A não precisa de foto; NC sem descrição bloqueia", async () => {
    const fvs = await novaFvs();
    await responderTudo(fvs, "NA");
    expect(await concluir(fvs)).toBeNull();
    const fvs2 = await novaFvs();
    await responderTudo(fvs2, "NA");
    await db.query("update respostas set resultado = 'NC', observacao = '' where id = (select id from respostas where inspecao_id = $1 order by ordem limit 1)", [fvs2]);
    expect(await concluir(fvs2)).toBe("23514");
  });
});

describe("PDF da FVS (bucket fvs-pdfs)", () => {
  it("só depois de concluir; registrado na FVS; outra empresa não vê", async () => {
    const fvs = await novaFvs();
    const pdf = caminho(fvs, "FVS-1.pdf");
    const enviarPdf = (user: string, path = pdf) =>
      pgErrorCode(asUser(db, user, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('fvs-pdfs', $1)", [path])));
    expect(await enviarPdf(INSP_A)).toBe("42501"); // ainda em rascunho
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("select public.registrar_pdf_fvs($1, $2)", [fvs, pdf])))).toBe("23514");

    await db.query("update respostas set resultado = 'NA' where inspecao_id = $1", [fvs]);
    await asUser(db, INSP_A, (tx) => tx.query("update inspecoes set status = 'concluida', concluida_em = now(), assinaturas = $2 where id = $1", [fvs, ASSINATURA]));

    expect(await enviarPdf(INSP_A)).toBeNull();
    await asUser(db, INSP_A, (tx) => tx.query("select public.registrar_pdf_fvs($1, $2)", [fvs, pdf]));
    expect(await one(db, "select pdf_path from inspecoes where id = $1", [fvs])).toEqual({ pdf_path: pdf });
    expect(await pgErrorCode(asUser(db, INSP_A, (tx) => tx.query("select public.registrar_pdf_fvs($1, $2)", [fvs, `${EMPRESA_A}/${empA}/outra/x.pdf`])))).toBe("23514");

    await asUser(db, ADMIN_B, async (tx) => expect(await count(tx, "select 1 from storage.objects where bucket_id = 'fvs-pdfs'")).toBe(0));
    expect(await pgErrorCode(asUser(db, ADMIN_B, (tx) => tx.query("select public.registrar_pdf_fvs($1, $2)", [fvs, pdf])))).toBe("P0002");
    expect(await enviarPdf(INSP_SEM, caminho(fvs, "outro.pdf"))).toBe("42501");
  });
});
