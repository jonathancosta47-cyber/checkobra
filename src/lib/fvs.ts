export type FvsResult = "C" | "NC" | "NA" | null;
export interface FvsTemplate { id: string; name: string; items: string[] }
export interface FvsItem { text: string; result: FvsResult; note: string }
export interface FvsInspection {
  id: string; number: number; createdAt: string; templateName: string;
  obra: string; local: string; responsavel: string; items: FvsItem[];
  observations: string; executor?: string; unit?: string; quantity?: string; unitPrice?: string; photos: string[]; signature: string | null; signedBy: string;
}

const TKEY = "os-manutencao:fvs-templates";
const IKEY = "os-manutencao:fvs";
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

const defaults: FvsTemplate[] = [
  { id: "alvenaria", name: "Alvenaria de vedação", items: ["Locação conforme projeto", "Prumo e nível", "Espessura das juntas", "Amarração entre blocos", "Vergas e contravergas"] },
  { id: "contrapiso", name: "Contrapiso", items: ["Limpeza da base", "Nível e caimento", "Espessura conforme projeto", "Ausência de fissuras", "Cura adequada"] },
];

export const loadTemplates = (): FvsTemplate[] => read(TKEY, defaults);
export const saveTemplates = (t: FvsTemplate[]) => localStorage.setItem(TKEY, JSON.stringify(t));
export const loadInspections = (): FvsInspection[] => read(IKEY, []);
export const getInspection = (id: string) => loadInspections().find((i) => i.id === id);
export function saveInspection(i: FvsInspection) {
  localStorage.setItem(IKEY, JSON.stringify([i, ...loadInspections().filter((x) => x.id !== i.id)]));
}
export const deleteInspection = (id: string) => localStorage.setItem(IKEY, JSON.stringify(loadInspections().filter((x) => x.id !== id)));
export const nextFvsNumber = () => loadInspections().reduce((m, i) => Math.max(m, i.number), 0) + 1;
export const resultLabel = { C: "Conforme", NC: "Não conforme", NA: "Não se aplica" } as const;

export const parseNum = (v?: string) => { const n = parseFloat((v || "").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
export const fvsTotal = (f: { quantity?: string; unitPrice?: string }) => parseNum(f.quantity) * parseNum(f.unitPrice);
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
