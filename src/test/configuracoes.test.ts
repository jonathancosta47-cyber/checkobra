import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  empreiteirosParaServico,
  formatarCnpj,
  itensParaSalvar,
  modelosParaFvs,
  moverItem,
  ordenarModelos,
  servicosUnicos,
  validarEmpreiteiro,
  validarModelo,
} from "@/lib/configuracoes";

describe("modelos de FVS", () => {
  it("valida nome e itens", () => {
    expect(validarModelo({ nome: " ", itens: [{ texto: "a", criterio: "", exige_foto: false }] })).toMatch(/nome/);
    expect(validarModelo({ nome: "X", itens: [] })).toMatch(/ao menos um item/);
    expect(validarModelo({ nome: "X", itens: [{ texto: "a", criterio: "", exige_foto: false }, { texto: " ", criterio: "", exige_foto: false }] })).toBe("O item 2 está sem descrição.");
    expect(validarModelo({ nome: "X", itens: [{ texto: "a", criterio: "", exige_foto: true }] })).toBeNull();
  });

  it("envia os itens limpos para o banco", () => {
    expect(itensParaSalvar([{ id: "i", texto: " Prumo ", criterio: " 0,5 cm ", exige_foto: true }])).toEqual([{ texto: "Prumo", criterio: "0,5 cm", exige_foto: true }]);
  });

  it("FVS só oferece modelos ativos e atuais, da empresa antes dos padrão", () => {
    const ms = [
      { empresa_id: null, nome: "Alvenaria", ativo: true, atual: true },
      { empresa_id: "e", nome: "Pintura", ativo: true, atual: true },
      { empresa_id: "e", nome: "Antigo", ativo: true, atual: false },
      { empresa_id: "e", nome: "Desligado", ativo: false, atual: true },
      { empresa_id: "e", nome: "Contrapiso", ativo: true, atual: true },
    ];
    expect(modelosParaFvs(ms).map((m) => m.nome)).toEqual(["Contrapiso", "Pintura", "Alvenaria"]);
    expect(ordenarModelos(ms).at(-1)!.empresa_id).toBeNull();
  });

  it("move itens para cima e para baixo sem sair da lista", () => {
    expect(moverItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    expect(moverItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
});

describe("empreiteiros", () => {
  it("formata e confere o CNPJ pelos dígitos verificadores", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("11.222")).toBe("11.222");
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });

  it("valida o cadastro", () => {
    expect(validarEmpreiteiro({ nome: "", cnpj: "", email: "" })).toMatch(/nome/);
    expect(validarEmpreiteiro({ nome: "X", cnpj: "11.222.333/0001-82", email: "" })).toMatch(/CNPJ/);
    expect(validarEmpreiteiro({ nome: "X", cnpj: "", email: "x@" })).toMatch(/E-mail/);
    expect(validarEmpreiteiro({ nome: "X", cnpj: "11222333000181", email: "a@b.co" })).toBeNull();
  });

  it("na FVS: só ativos, primeiro quem executa o serviço do modelo (sem acento/maiúscula)", () => {
    const lista = [
      { nome: "Zeta", servicos: ["Alvenaria"], ativo: true },
      { nome: "Alfa", servicos: ["Pintura"], ativo: true },
      { nome: "Beta", servicos: ["alvenaria"], ativo: false },
    ];
    const r = empreiteirosParaServico(lista, "Alvenária");
    expect(r.map((e) => [e.nome, e.executaServico])).toEqual([["Zeta", true], ["Alfa", false]]);
  });

  it("junta serviços sem repetir", () => {
    expect(servicosUnicos([["Alvenaria", "pintura"], ["Pintura ", "Contrapiso"], [""]])).toEqual(["Alvenaria", "Contrapiso", "pintura"]);
  });
});
