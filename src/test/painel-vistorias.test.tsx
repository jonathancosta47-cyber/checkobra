import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { Delivery, DeliveryItem } from "@/lib/delivery";
import type { Local } from "@/lib/empreendimentos";
import { montarPainel, situacaoDaVistoria } from "@/lib/painel-vistorias";
import { PainelVistorias } from "@/components/PainelVistorias";

const loc = (id: string, tipo: Local["tipo"], pai_id: string | null, nome = id, ordem = 0): Local => ({ id, empreendimento_id: "e", pai_id, tipo, nome, ordem });
const item = (result: DeliveryItem["result"], status: DeliveryItem["status"] = "Aberta"): DeliveryItem => ({
  id: Math.random().toString(), text: "x", criteria: "", result, description: "", location: "", photos: [], owner: "", deadline: "", status, severity: "",
});
const vistoria = (id: string, result: string, itens: DeliveryItem[] = [], createdAt = "2026-11-10T10:00:00Z"): Delivery => ({
  id, createdAt,
  unit: { development: "", tower: "", apartment: "", floor: "", area: "", date: "", inspector: "", representative: "", buyer: "" },
  rooms: [{ id: "r", name: "Sala", items: itens }], documents: [], result, observations: "", photos: [], signatures: [],
});

// Torre A: 1º pav (101, 102, 110) e 2º pav (201) + hall; área comum geral: Piscina
const locais = [
  loc("tA", "torre", null, "Torre A", 1),
  loc("p1", "pavimento", "tA", "1º pavimento", 1),
  loc("p2", "pavimento", "tA", "2º pavimento", 2),
  loc("u110", "unidade", "p1", "110", 10),
  loc("u101", "unidade", "p1", "101", 1),
  loc("u102", "unidade", "p1", "102", 2),
  loc("u201", "unidade", "p2", "201", 1),
  loc("hall", "area_comum", "p1", "Hall", 1001),
  loc("pisc", "area_comum", null, "Piscina", 1001),
];
const vistorias = [
  { delivery: vistoria("v-antiga", "Reprovado – necessita correções", [], "2026-11-01T10:00:00Z"), localId: "u101" },
  { delivery: vistoria("v101", "Aprovado para entrega", [], "2026-11-12T10:00:00Z"), localId: "u101" },
  { delivery: vistoria("v102", "", [item("NC")]), localId: "u102" },
  { delivery: vistoria("v201", "Aprovado com ressalvas"), localId: "u201" },
  { delivery: vistoria("vpisc", ""), localId: "pisc" },
  { delivery: vistoria("solta", "Aprovado para entrega"), localId: null },
];

describe("situação da unidade", () => {
  it("vem do resultado e das pendências abertas", () => {
    expect(situacaoDaVistoria(undefined)).toBe("sem");
    expect(situacaoDaVistoria(vistoria("a", "Aprovado para entrega"))).toBe("aprovada");
    expect(situacaoDaVistoria(vistoria("a", "Aprovado com ressalvas"))).toBe("ressalvas");
    expect(situacaoDaVistoria(vistoria("a", "Aguardando reinspeção"))).toBe("ressalvas");
    expect(situacaoDaVistoria(vistoria("a", "Reprovado – necessita correções"))).toBe("pendente");
    expect(situacaoDaVistoria(vistoria("a", "Aprovado para entrega", [item("NC")]))).toBe("pendente");
    expect(situacaoDaVistoria(vistoria("a", "Aprovado para entrega", [item("NC", "Encerrada")]))).toBe("aprovada");
    expect(situacaoDaVistoria(vistoria("a", ""))).toBe("em_vistoria");
  });
});

describe("montarPainel", () => {
  const p = montarPainel(locais, vistorias);
  it("pavimentos do mais alto ao térreo; unidades em ordem numérica; vale a vistoria mais recente", () => {
    const torre = p.torres[0]!;
    expect(torre.pavimentos.map((x) => x.pavimento.nome)).toEqual(["2º pavimento", "1º pavimento"]);
    expect(torre.pavimentos[1]!.unidades.map((u) => u.local.nome)).toEqual(["101", "102", "110"]);
    expect(torre.pavimentos[1]!.unidades.map((u) => u.situacao)).toEqual(["aprovada", "pendente", "sem"]);
    expect(torre.pavimentos[1]!.unidades[0]!.vistoria?.id).toBe("v101");
    expect(torre.pavimentos[1]!.areas.map((a) => a.local.nome)).toEqual(["Hall"]);
  });
  it("conta unidades por situação e as áreas comuns à parte", () => {
    expect(p.totalUnidades).toBe(4);
    expect(p.vistoriadas).toBe(3);
    expect(p.contagem).toEqual({ aprovada: 1, ressalvas: 1, pendente: 1, em_vistoria: 0, sem: 1 });
    expect(p.totalAreas).toBe(2);
    expect(p.areasVistoriadas).toBe(1);
    expect(p.areasGerais.map((a) => a.local.nome)).toEqual(["Piscina"]);
  });
});

function renderPainel() {
  const root = createRootRoute();
  const inicio = createRoute({ getParentRoute: () => root, path: "/", component: () => <PainelVistorias locais={locais} vistorias={vistorias} /> });
  const nova = createRoute({ getParentRoute: () => root, path: "/vistorias/nova", component: () => <p>Nova vistoria</p> });
  const ver = createRoute({ getParentRoute: () => root, path: "/vistorias/$id", component: () => <p>Vistoria aberta</p> });
  const router = createRouter({ routeTree: root.addChildren([inicio, nova, ver]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  return router;
}

describe("PainelVistorias", () => {
  it("mostra indicadores, legenda com ícone e número, e o mapa por pavimento", async () => {
    renderPainel();
    expect(await screen.findByText("Unidades por pavimento")).toBeInTheDocument();
    expect(screen.getByText("Vistoriadas").nextSibling?.textContent).toBe("3");
    expect(screen.getByRole("img", { name: /Aprovadas: 1, Com ressalvas: 1, Com pendências: 1, Em vistoria: 0, Sem vistoria: 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^102 · Com pendências \/ reprovada · 1 pendência/ })).toBeInTheDocument();
    expect(screen.getByText(/1 de 2 vistoriadas/)).toBeInTheDocument();
  });

  it("unidade com vistoria abre a vistoria; sem vistoria começa uma nova naquela unidade", async () => {
    const router = renderPainel();
    fireEvent.click(await screen.findByRole("button", { name: /^101 ·/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/vistorias/v101"));
    router.history.push("/");
    fireEvent.click(await screen.findByRole("button", { name: /^110 ·/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/vistorias/nova"));
    expect(router.state.location.search).toEqual({ local: "u110" });
  });
});
