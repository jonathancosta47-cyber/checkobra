import { describe, expect, it } from "vitest";
import type { Delivery, DeliveryItem } from "@/lib/delivery";
import type { InspecaoResumo } from "@/lib/fvs-db";
import type { ServiceOrder } from "@/lib/orders";
import {
  atividadesRecentes,
  contarPendencias,
  destinoDoMais,
  filtrarFvs,
  filtrarOS,
  filtrarRelatorios,
  filtrarVistorias,
  moduloDaRota,
  progressoFvs,
  progressoOS,
  progressoVistoria,
  registros,
} from "@/lib/modules";

const os = (p: Partial<ServiceOrder>): ServiceOrder => ({
  id: "os", number: 1, createdAt: "2026-11-01T12:00:00", status: "aberta",
  client: { name: "Cliente", phone: "", email: "", document: "", address: "" },
  equipment: "", problem: "", service: "", technician: "", value: "", photos: [], signature: null, signedBy: "", ...p,
});
const item = (result: DeliveryItem["result"], status: DeliveryItem["status"] = "Aberta"): DeliveryItem => ({
  id: Math.random().toString(), text: "x", criteria: "", result, description: "", location: "", photos: [], owner: "", deadline: "", status, severity: "",
});
const vistoria = (p: Partial<Delivery> & { itens?: DeliveryItem[] }): Delivery => ({
  id: "v", createdAt: "2026-11-02T12:00:00",
  unit: { development: "Residencial Vista Verde", tower: "Torre A", apartment: "101", floor: "1", area: "", date: "", inspector: "", representative: "", buyer: "Maria" },
  rooms: [{ id: "r", name: "Sala", items: p.itens ?? [] }],
  documents: [], result: "", observations: "", photos: [], signatures: [], ...p,
});
const fvs = (p: Partial<InspecaoResumo>): InspecaoResumo => ({
  id: "f", numero: 1, status: "concluida", criadaEm: "2026-11-03T12:00:00", concluidaEm: null, inspetorId: "u",
  empreendimentoId: "o", obra: "Edifício Jardins", localId: "l", local: "Torre A", modelo: "Alvenaria", modeloVersao: 1, modeloServico: "",
  empreiteiroId: null, pdfPath: null, pdfGeradoEm: null, total: 0, respondidos: 0, nc: 0, ...p,
});

describe("botão + e módulo atual", () => {
  it("cria no módulo da tela; na Início e em Relatórios abre o menu", () => {
    expect(destinoDoMais("/os")).toBe("/os/nova");
    expect(destinoDoMais("/os/abc")).toBe("/os/nova");
    expect(destinoDoMais("/vistorias/")).toBe("/vistorias/nova");
    expect(destinoDoMais("/fvs/modelos")).toBe("/fvs/nova");
    expect(destinoDoMais("/")).toBeNull();
    expect(destinoDoMais("/relatorios")).toBeNull();
    expect(destinoDoMais("/configuracoes")).toBeNull();
    expect(moduloDaRota("/osx")).toBeNull();
  });
});

describe("pendências e progresso", () => {
  const dados = registros(
    [os({ id: "a", status: "aberta" }), os({ id: "b", status: "em_andamento" }), os({ id: "c", status: "concluida" })],
    [vistoria({ id: "v1", itens: [item("NC", "Aberta"), item("C")] }), vistoria({ id: "v2", itens: [item("NC", "Encerrada")] })],
    [fvs({ id: "f1", total: 1, respondidos: 1, nc: 1 }), fvs({ id: "f2", total: 1, respondidos: 1, nc: 0 })],
  );

  it("conta OS não fechadas, unidades com pendência aberta e fichas com NC", () => {
    expect(contarPendencias(dados)).toEqual({ os: 2, vistorias: 1, fvs: 1 });
  });

  it("calcula o progresso de cada tipo de registro", () => {
    expect(progressoOS(os({ status: "concluida" }))).toBe(100);
    expect(progressoOS(os({ checks: [{ text: "a", result: "C" }, { text: "b", result: "P" }] }))).toBe(50);
    expect(progressoVistoria(vistoria({ itens: [item("C"), item(null), item("NC"), item(null)] }))).toBe(50);
    expect(progressoFvs(fvs({ total: 3, respondidos: 1 }))).toBe(33);
    expect(progressoFvs(fvs({ total: 0 }))).toBe(0);
  });

  it("atividades recentes vêm da mais nova para a mais antiga", () => {
    expect(atividadesRecentes(dados, 2).map((r) => r.modulo)).toEqual(["fvs", "fvs"]);
    expect(atividadesRecentes(dados).length).toBe(5);
  });
});

describe("filtros de cada módulo", () => {
  it("OS: busca sem acento e status", () => {
    const lista = [os({ id: "1", client: { name: "João Ávila", phone: "", email: "", document: "", address: "" } }), os({ id: "2", status: "concluida" })];
    expect(filtrarOS(lista, { q: "joao avila" }).map((o) => o.id)).toEqual(["1"]);
    expect(filtrarOS(lista, { status: "concluida" }).map((o) => o.id)).toEqual(["2"]);
    expect(filtrarOS(lista, { status: "todas" })).toHaveLength(2);
  });

  it("Vistorias: pendência, obra e busca", () => {
    const lista = [
      vistoria({ id: "1", itens: [item("NC")] }),
      vistoria({ id: "2", unit: { ...vistoria({}).unit, development: "Edifício Jardins", apartment: "202" } }),
    ];
    expect(filtrarVistorias(lista, { pendencia: "com" }).map((d) => d.id)).toEqual(["1"]);
    expect(filtrarVistorias(lista, { pendencia: "sem" }).map((d) => d.id)).toEqual(["2"]);
    expect(filtrarVistorias(lista, { obra: "Edifício Jardins" }).map((d) => d.id)).toEqual(["2"]);
    expect(filtrarVistorias(lista, { q: "202" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("FVS: NC, status, obra e modelo", () => {
    const lista = [fvs({ id: "1", nc: 2 }), fvs({ id: "2", modelo: "Contrapiso", obra: "Vista Verde", status: "rascunho" })];
    expect(filtrarFvs(lista, { nc: "com" }).map((f) => f.id)).toEqual(["1"]);
    expect(filtrarFvs(lista, { status: "rascunho" }).map((f) => f.id)).toEqual(["2"]);
    expect(filtrarFvs(lista, { modelo: "Contrapiso" }).map((f) => f.id)).toEqual(["2"]);
    expect(filtrarFvs(lista, { obra: "Edifício Jardins" }).map((f) => f.id)).toEqual(["1"]);
  });
});

describe("relatórios", () => {
  const dados = registros(
    [os({ id: "o", createdAt: "2026-10-05T10:00:00", client: { name: "Cli", phone: "", email: "", document: "", address: "Rua A" } })],
    [vistoria({ id: "v", createdAt: "2026-11-10T10:00:00" })],
    [fvs({ id: "f", criadaEm: "2026-11-20T10:00:00" })],
  );
  it("filtra por módulo, obra e período, do mais novo para o mais antigo", () => {
    expect(filtrarRelatorios(dados, {}).map((r) => r.id)).toEqual(["f", "v", "o"]);
    expect(filtrarRelatorios(dados, { modulo: "vistorias" }).map((r) => r.id)).toEqual(["v"]);
    expect(filtrarRelatorios(dados, { obra: "jardins" }).map((r) => r.id)).toEqual(["f"]);
    expect(filtrarRelatorios(dados, { de: "2026-11-01", ate: "2026-11-15" }).map((r) => r.id)).toEqual(["v"]);
  });
});
