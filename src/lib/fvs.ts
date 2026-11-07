export type FvsResult = "C" | "NC" | "NA" | null;
export interface FvsTemplate { id: string; name: string; items: string[]; criteria?: string[] }
export interface FvsItem { text: string; result: FvsResult; note: string; criteria?: string }
export interface CrewMember { role: string; qty: string }
export interface FvsInspection {
  id: string; number: number; createdAt: string; templateName: string;
  obra: string; local: string; responsavel: string; items: FvsItem[];
  observations: string; executor?: string; crew?: string; crewList?: CrewMember[]; unit?: string; quantity?: string; unitPrice?: string; photos: string[]; signature: string | null; signedBy: string;
}

const TKEY = "os-manutencao:fvs-templates";
const IKEY = "os-manutencao:fvs";
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

const defaults: FvsTemplate[] = [
  { id: "alvenaria", name: "Alvenaria de vedação", items: ["Locação conforme projeto", "Prumo e nível", "Espessura das juntas", "Amarração entre blocos", "Vergas e contravergas"], criteria: ["Desvio máx. 1 cm", "Prumo até 0,5 cm", "Juntas de 1 a 2 cm", "Juntas desencontradas", "Apoio mín. 20 cm"] },
  { id: "contrapiso", name: "Contrapiso", items: ["Limpeza da base", "Nível e caimento", "Espessura conforme projeto", "Ausência de fissuras", "Cura adequada"], criteria: ["Sem pó ou entulho", "Desnível até 0,5 cm", "Conforme projeto ±1 cm", "Sem fissuras visíveis", "Mín. 7 dias úmido"] },
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

export interface Contract { service: string; unit: string; unitPrice: string }
export interface Contractor { id: string; name: string; contracts: Contract[] }
const CKEY = "os-manutencao:empreiteiros";
export const loadContractors = (): Contractor[] => read(CKEY, []);
export const saveContractors = (c: Contractor[]) => localStorage.setItem(CKEY, JSON.stringify(c));
/** Finds the contract price for a contractor name + service (template) name. */
export function findContract(list: Contractor[], executor?: string, service?: string): Contract | undefined {
  const norm = (x?: string) => (x || "").trim().toLowerCase();
  const c = list.find((x) => norm(x.name) === norm(executor));
  return c?.contracts.find((k) => norm(k.service) === norm(service));
}
