import { describe, expect, it } from "vitest";
import {
  contarPorTipo,
  descendentes,
  filhosDe,
  previaEstrutura,
  progressoEntrega,
  sugerirNome,
  tiposFilhos,
  validarEstrutura,
  type Local,
} from "@/lib/empreendimentos";
import { paraDados, paraOrdem } from "@/lib/os-store";

const loc = (id: string, tipo: Local["tipo"], nome: string, pai_id: string | null, ordem = 0): Local => ({ id, empreendimento_id: "e", pai_id, tipo, nome, ordem });
const locais = [
  loc("ac", "area_comum", "Piscina", null, 1001),
  loc("tA", "torre", "Torre A", null, 1),
  loc("tB", "torre", "Torre B", null, 2),
  loc("p1", "pavimento", "1º pavimento", "tA", 1),
  loc("p10", "pavimento", "10º pavimento", "tA", 10),
  loc("u101", "unidade", "101", "p1", 1),
  loc("u102", "unidade", "102", "p1", 2),
  loc("hall", "area_comum", "Hall", "p1", 1001),
];

describe("estrutura do empreendimento", () => {
  it("o que pode ser criado em cada nível", () => {
    expect(tiposFilhos(null)).toEqual(["torre", "area_comum"]);
    expect(tiposFilhos("torre")).toEqual(["pavimento", "area_comum"]);
    expect(tiposFilhos("pavimento")).toEqual(["unidade", "area_comum"]);
    expect(tiposFilhos("unidade")).toEqual([]);
  });

  it("lista torres antes das áreas comuns e conta por tipo", () => {
    expect(filhosDe(locais, null).map((l) => l.nome)).toEqual(["Torre A", "Torre B", "Piscina"]);
    expect(filhosDe(locais, "p1").map((l) => l.nome)).toEqual(["101", "102", "Hall"]);
    expect(contarPorTipo(locais)).toEqual({ torre: 2, pavimento: 2, unidade: 2, area_comum: 2 });
    expect(descendentes(locais, "tA").map((l) => l.id).sort()).toEqual(["hall", "p1", "p10", "u101", "u102"]);
  });

  it("sugere o próximo nome seguindo a numeração", () => {
    const tA = locais.find((l) => l.id === "tA")!;
    const p1 = locais.find((l) => l.id === "p1")!;
    expect(sugerirNome(locais, null, "torre")).toBe("Torre C");
    expect(sugerirNome(locais, tA, "pavimento")).toBe("11º pavimento");
    expect(sugerirNome(locais, p1, "unidade")).toBe("103");
    const p10 = locais.find((l) => l.id === "p10")!;
    expect(sugerirNome(locais, p10, "unidade")).toBe("1001");
    expect(sugerirNome(locais, null, "area_comum")).toBe("Nova área comum");
  });
});

describe("assistente", () => {
  it("prévia igual à regra do banco: 101 até pavimentos × 100 + unidades", () => {
    expect(previaEstrutura({ torres: 2, pavimentos: 10, unidades: 4 })).toMatchObject({
      torres: 2, pavimentos: 20, unidades: 80, nomesTorres: ["Torre A", "Torre B"], primeiraUnidade: "101", ultimaUnidade: "1004",
    });
    expect(previaEstrutura({ torres: 0, pavimentos: 3, unidades: 2 }).unidades).toBe(0);
  });

  it("valida nome e limites", () => {
    expect(validarEstrutura({ nome: " ", torres: 1, pavimentos: 1, unidades: 1 })).toMatch(/nome/);
    expect(validarEstrutura({ nome: "X", torres: 27, pavimentos: 1, unidades: 1 })).toMatch(/torres/);
    expect(validarEstrutura({ nome: "X", torres: 1, pavimentos: 0, unidades: 1 })).toMatch(/pavimentos/);
    expect(validarEstrutura({ nome: "X", torres: 1, pavimentos: 1, unidades: 100 })).toMatch(/unidades/);
    expect(validarEstrutura({ nome: "X", torres: 1, pavimentos: 1, unidades: NaN })).toMatch(/unidades/);
    expect(validarEstrutura({ nome: "X", torres: 2, pavimentos: 10, unidades: 4 })).toBeNull();
  });
});

describe("progresso de entrega", () => {
  it("conta unidades com vistoria aprovada (sem repetir a mesma unidade)", () => {
    expect(
      progressoEntrega(4, [
        { local_id: "u1", resultado: "Aprovado para entrega" },
        { local_id: "u1", resultado: "Aprovado com ressalvas" },
        { local_id: "u2", resultado: "Reprovado – necessita correções" },
        { local_id: null, resultado: "Aprovado para entrega" },
      ]),
    ).toEqual({ aprovadas: 1, total: 4, pct: 25 });
    expect(progressoEntrega(0, [])).toEqual({ aprovadas: 0, total: 0, pct: 0 });
  });
});

describe("OS no banco", () => {
  it("converte a linha do banco para o formulário e volta, sem duplicar colunas", () => {
    const ordem = paraOrdem({
      id: "o1", numero: 7, status: "em_andamento", created_at: "2026-11-16T10:00:00Z", empreendimento_id: "e", local_id: null,
      dados: { client: { name: "Ana", phone: "", email: "", document: "", address: "" }, equipment: "Bomba", photos: ["x"] },
    });
    expect(ordem).toMatchObject({ id: "o1", number: 7, status: "em_andamento", equipment: "Bomba", photos: ["x"], signedBy: "" });
    const dados = paraDados(ordem) as Record<string, unknown>;
    expect(dados).not.toHaveProperty("id");
    expect(dados).not.toHaveProperty("number");
    expect(dados).not.toHaveProperty("status");
    expect(dados).toMatchObject({ equipment: "Bomba" });
  });
});
