// Regras dos 3 módulos (OS, Vistorias de entrega, FVS) e da área de Relatórios.
// Só lógica, sem tela e sem acesso a banco: fácil de testar e de reaproveitar.
import { pendingCount, type Delivery } from "./delivery";
import { numeroFvs, progresso, type InspecaoResumo } from "./fvs-db";
import type { OrderStatus, ServiceOrder } from "./orders";

export type Modulo = "os" | "vistorias" | "fvs";

export const MODULOS: Record<Modulo, { nome: string; nomeCurto: string; lista: string; novo: string; novoRotulo: string }> = {
  os: { nome: "Ordens de Serviço", nomeCurto: "OS", lista: "/os", novo: "/os/nova", novoRotulo: "Nova OS" },
  vistorias: { nome: "Vistorias de entrega", nomeCurto: "Vistorias", lista: "/vistorias", novo: "/vistorias/nova", novoRotulo: "Nova vistoria" },
  fvs: { nome: "FVS", nomeCurto: "FVS", lista: "/fvs", novo: "/fvs/nova", novoRotulo: "Nova FVS" },
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const contem = (texto: string, q: string) => semAcento(texto).includes(semAcento(q.trim()));

// ───────────── módulo atual e botão "+" ─────────────

export function moduloDaRota(pathname: string): Modulo | null {
  pathname = pathname.replace(/\/+$/, "") || "/";
  for (const m of ["os", "vistorias", "fvs"] as const) {
    const base = MODULOS[m].lista;
    if (pathname === base || pathname.startsWith(base + "/")) return m;
  }
  return null;
}

// Para onde o "+" leva; null = abrir o menu de escolha (Início e Relatórios).
export const destinoDoMais = (pathname: string) => {
  const m = moduloDaRota(pathname);
  return m ? MODULOS[m].novo : null;
};

// ───────────── pendências e progresso ─────────────

export const ncDaFvs = (f: InspecaoResumo) => f.nc;

export const osPendente = (o: ServiceOrder) => o.status !== "concluida";
export const vistoriaPendente = (d: Delivery) => pendingCount(d) > 0;
export const fvsPendente = (f: InspecaoResumo) => f.nc > 0;

const pct = (feitos: number, total: number) => (total ? Math.round((feitos / total) * 100) : 0);

export function progressoOS(o: ServiceOrder) {
  const itens = (o.checks ?? []).filter((c) => c.text.trim());
  if (itens.length) return pct(itens.filter((c) => c.result === "C").length, itens.length);
  return ({ aberta: 0, em_andamento: 50, concluida: 100 } as Record<OrderStatus, number>)[o.status];
}
export function progressoVistoria(d: Delivery) {
  const itens = d.rooms.flatMap((r) => r.items);
  return pct(itens.filter((i) => i.result !== null).length, itens.length);
}
export const progressoFvs = (f: InspecaoResumo) => progresso(f);

// ───────────── obras (para filtros) ─────────────

export const obraDaOS = (o: ServiceOrder) => o.client.address.trim() || o.client.name.trim();
export const obraDaVistoria = (d: Delivery) => d.unit.development.trim();
export const obraDaFvs = (f: InspecaoResumo) => f.obra.trim();

const unicas = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
export const obrasDasVistorias = (ds: Delivery[]) => unicas(ds.map(obraDaVistoria));
export const obrasDasFvs = (fs: InspecaoResumo[]) => unicas(fs.map(obraDaFvs));
export const modelosDasFvs = (fs: InspecaoResumo[]) => unicas(fs.map((f) => f.modelo));

// ───────────── filtros de cada módulo ─────────────

export type FiltroStatusOS = "todas" | OrderStatus;
export function filtrarOS(list: ServiceOrder[], f: { q?: string; status?: FiltroStatusOS }) {
  return list.filter(
    (o) =>
      (!f.status || f.status === "todas" || o.status === f.status) &&
      (!f.q || contem(`${o.number} ${o.client.name} ${o.equipment} ${o.client.address}`, f.q)),
  );
}

export type FiltroPendencia = "todas" | "com" | "sem";
export function filtrarVistorias(list: Delivery[], f: { q?: string; pendencia?: FiltroPendencia; obra?: string }) {
  return list.filter(
    (d) =>
      (!f.pendencia || f.pendencia === "todas" || (f.pendencia === "com") === vistoriaPendente(d)) &&
      (!f.obra || obraDaVistoria(d) === f.obra) &&
      (!f.q || contem(`${d.unit.development} ${d.unit.tower} ${d.unit.apartment} ${d.unit.buyer}`, f.q)),
  );
}

export type FiltroStatusFvs = "todas" | "rascunho" | "concluida";
export function filtrarFvs(
  list: InspecaoResumo[],
  f: { q?: string; nc?: FiltroPendencia; obra?: string; modelo?: string; status?: FiltroStatusFvs },
) {
  return list.filter(
    (i) =>
      (!f.nc || f.nc === "todas" || (f.nc === "com") === fvsPendente(i)) &&
      (!f.status || f.status === "todas" || i.status === f.status) &&
      (!f.obra || obraDaFvs(i) === f.obra) &&
      (!f.modelo || i.modelo === f.modelo) &&
      (!f.q || contem(`${i.numero} ${i.modelo} ${i.obra} ${i.local}`, f.q)),
  );
}

// ───────────── visão geral: Início e Relatórios ─────────────

export interface Registro {
  modulo: Modulo;
  id: string;
  titulo: string;
  detalhe: string;
  obra: string;
  data: string; // ISO
  pendente: boolean;
  situacao: string;
  pdfPath?: string | null; // PDF oficial salvo (FVS concluída)
}

const num = (n: number) => `#${String(n).padStart(4, "0")}`;
const statusOS: Record<OrderStatus, string> = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Fechada" };

export function registros(os: ServiceOrder[], vistorias: Delivery[], fvs: InspecaoResumo[]): Registro[] {
  return [
    ...os.map((o) => ({
      modulo: "os" as const,
      id: o.id,
      titulo: `OS ${num(o.number)} · ${o.client.name || "Sem cliente"}`,
      detalhe: o.equipment || "—",
      obra: obraDaOS(o),
      data: o.createdAt,
      pendente: osPendente(o),
      situacao: statusOS[o.status],
    })),
    ...vistorias.map((d) => ({
      modulo: "vistorias" as const,
      id: d.id,
      titulo: `${d.unit.development || "Empreendimento"} · Apto ${d.unit.apartment || "—"}`,
      detalhe: [d.unit.tower, d.unit.buyer].filter(Boolean).join(" · ") || "—",
      obra: obraDaVistoria(d),
      data: d.createdAt,
      pendente: vistoriaPendente(d),
      situacao: d.result || (pendingCount(d) ? `${pendingCount(d)} pendências` : "Em vistoria"),
    })),
    ...fvs.map((i) => ({
      modulo: "fvs" as const,
      id: i.id,
      titulo: `${numeroFvs(i.numero)} · ${i.modelo || "Sem modelo"}`,
      detalhe: [i.obra, i.local].filter(Boolean).join(" · ") || "—",
      obra: obraDaFvs(i),
      data: i.criadaEm,
      pendente: fvsPendente(i),
      situacao: i.nc ? `${i.nc} NC` : i.status === "rascunho" ? "Em andamento" : "Conforme",
      pdfPath: i.pdfPath,
    })),
  ];
}

const maisRecentes = (a: Registro, b: Registro) => b.data.localeCompare(a.data);
export const atividadesRecentes = (todos: Registro[], n = 5) => [...todos].sort(maisRecentes).slice(0, n);

export const contarPendencias = (todos: Registro[]): Record<Modulo, number> => ({
  os: todos.filter((r) => r.modulo === "os" && r.pendente).length,
  vistorias: todos.filter((r) => r.modulo === "vistorias" && r.pendente).length,
  fvs: todos.filter((r) => r.modulo === "fvs" && r.pendente).length,
});

// Data local (AAAA-MM-DD) de um ISO, para o filtro de período.
export function dataLocal(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function filtrarRelatorios(
  todos: Registro[],
  f: { modulo?: Modulo | "todos"; obra?: string; de?: string; ate?: string },
) {
  return todos
    .filter((r) => {
      const dia = dataLocal(r.data);
      return (
        (!f.modulo || f.modulo === "todos" || r.modulo === f.modulo) &&
        (!f.obra || contem(r.obra, f.obra)) &&
        (!f.de || dia >= f.de) &&
        (!f.ate || dia <= f.ate)
      );
    })
    .sort(maisRecentes);
}
