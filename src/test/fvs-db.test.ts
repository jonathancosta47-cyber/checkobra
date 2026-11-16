import { describe, expect, it } from "vitest";
import {
  assinaturasCompletas,
  caminhoDoLocal,
  nomePdfFvs,
  contarRespostas,
  filhosDe,
  motivoParaNaoConcluir,
  nomeDoCaminho,
  podeEditar,
  respostasDoModelo,
  type Local,
  type Resposta,
} from "@/lib/fvs-db";

const loc = (id: string, tipo: Local["tipo"], nome: string, pai_id: string | null, ordem = 0): Local => ({ id, empreendimento_id: "o", pai_id, tipo, nome, ordem });
const locais = [
  loc("tB", "torre", "Torre B", null, 2),
  loc("tA", "torre", "Torre A", null, 1),
  loc("p1", "pavimento", "1º pavimento", "tA", 1),
  loc("u2", "unidade", "Apto 102", "p1", 2),
  loc("u1", "unidade", "Apto 101", "p1", 1),
];
const resp = (p: Partial<Resposta>): Resposta => ({ id: Math.random().toString(), item_id: null, ordem: 0, texto: "x", criterio: "", exige_foto: false, resultado: null, observacao: "", ...p });

describe("locais", () => {
  it("lista cada nível em ordem e monta o caminho torre › pavimento › unidade", () => {
    expect(filhosDe(locais, null).map((l) => l.nome)).toEqual(["Torre A", "Torre B"]);
    expect(filhosDe(locais, "p1").map((l) => l.nome)).toEqual(["Apto 101", "Apto 102"]);
    expect(nomeDoCaminho(caminhoDoLocal(locais, "u2"))).toBe("Torre A › 1º pavimento › Apto 102");
    expect(nomeDoCaminho(caminhoDoLocal(locais, "tB"))).toBe("Torre B");
    expect(caminhoDoLocal(locais, "nao-existe")).toEqual([]);
  });
});

describe("respostas", () => {
  it("copia os itens do modelo em ordem, com texto e critério", () => {
    const r = respostasDoModelo("insp", [
      { id: "i2", ordem: 2, texto: "Prumo", criterio: "0,5 cm", exige_foto: true },
      { id: "i1", ordem: 1, texto: "Locação", criterio: "1 cm", exige_foto: false },
    ]);
    expect(r).toEqual([
      { inspecao_id: "insp", item_id: "i1", ordem: 1, texto: "Locação", criterio: "1 cm", exige_foto: false },
      { inspecao_id: "insp", item_id: "i2", ordem: 2, texto: "Prumo", criterio: "0,5 cm", exige_foto: true },
    ]);
  });

  it("conta respondidos e NC", () => {
    expect(contarRespostas([resp({ resultado: "C" }), resp({ resultado: "NC" }), resp({})])).toEqual({ total: 3, respondidos: 2, nc: 1 });
  });

  it("só deixa concluir com tudo respondido e NC descrita", () => {
    expect(motivoParaNaoConcluir([resp({ resultado: "C" }), resp({})])).toBe("Falta responder 1 item.");
    expect(motivoParaNaoConcluir([resp({}), resp({})])).toBe("Faltam responder 2 itens.");
    expect(motivoParaNaoConcluir([resp({ resultado: "NC", observacao: "  " })])).toMatch(/Descreva o problema/);
    expect(motivoParaNaoConcluir([resp({ resultado: "NC", observacao: "Junta de 3 cm" }), resp({ resultado: "NA" })])).toBeNull();
  });
});

describe("quem pode editar (espelha a regra do banco)", () => {
  it("inspetor só a própria em rascunho; admin e engenheiro sempre", () => {
    const rascunho = { status: "rascunho" as const, inspetorId: "eu" };
    const concluida = { status: "concluida" as const, inspetorId: "eu" };
    expect(podeEditar({ id: "eu", papel: "inspetor" }, rascunho)).toBe(true);
    expect(podeEditar({ id: "eu", papel: "inspetor" }, concluida)).toBe(false);
    expect(podeEditar({ id: "outro", papel: "inspetor" }, rascunho)).toBe(false);
    expect(podeEditar({ id: "outro", papel: "engenheiro" }, concluida)).toBe(true);
    expect(podeEditar({ id: "outro", papel: "admin_empresa" }, concluida)).toBe(true);
  });
});

describe("concluir: fotos exigidas e assinatura (mesmas regras do banco)", () => {
  const ok = [{ papel: "inspetor" as const, imagem: "data:image/png;base64,AAA" }];
  it("item que exige foto, marcado C ou NC, precisa de foto; N/A não", () => {
    const r1 = resp({ id: "r1", exige_foto: true, resultado: "C" });
    const r2 = resp({ id: "r2", exige_foto: true, resultado: "NA" });
    expect(motivoParaNaoConcluir([r1, r2], {}, ok)).toBe("1 item exige foto e está sem foto.");
    expect(motivoParaNaoConcluir([r1, r2], { r1: 2 }, ok)).toBeNull();
  });
  it("sem assinatura do inspetor não conclui", () => {
    const r = resp({ resultado: "C" });
    expect(motivoParaNaoConcluir([r], {}, [])).toBe("Falta a assinatura do inspetor.");
    expect(motivoParaNaoConcluir([r], {}, [{ papel: "empreiteiro", imagem: "data:image/png;base64,A" }])).toBe("Falta a assinatura do inspetor.");
    expect(motivoParaNaoConcluir([r], {}, ok)).toBeNull();
  });
});

describe("assinaturas e nome do PDF", () => {
  it("sempre inspetor e empreiteiro, mantendo o que já foi assinado", () => {
    expect(assinaturasCompletas([{ papel: "empreiteiro", nome: "", imagem: "data:x" }], { inspetor: "Ana", empreiteiro: "Silva Ltda" })).toEqual([
      { papel: "inspetor", nome: "Ana", imagem: null },
      { papel: "empreiteiro", nome: "Silva Ltda", imagem: "data:x" },
    ]);
  });
  it("gera um nome de arquivo limpo", () => {
    expect(nomePdfFvs(7, "Alvenaria de Vedação / Térreo")).toBe("FVS-0007-alvenaria-de-vedacao-terreo.pdf");
    expect(nomePdfFvs(12, "")).toBe("FVS-0012.pdf");
  });
});
