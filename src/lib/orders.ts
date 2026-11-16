export type OrderStatus = "aberta" | "em_andamento" | "concluida";

export type CheckResult = "C" | "A" | "P";
export interface OrderCheck { text: string; result: CheckResult | null }
export const checkLabel: Record<CheckResult, string> = { C: "Concluído", A: "Em andamento", P: "Pendente" };

export interface ServiceOrder {
  id: string;
  number: number;
  createdAt: string;
  status: OrderStatus;
  client: { name: string; phone: string; email: string; document: string; address: string };
  equipment: string;
  problem: string;
  service: string;
  technician: string;
  value: string;
  photos: string[];
  signature: string | null;
  signedBy: string;
  openerName?: string;
  openerSignature?: string | null;
  techSignature?: string | null;
  checks?: OrderCheck[];
}

const KEY = "os-manutencao:orders";

export function loadOrders(): ServiceOrder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveOrder(order: ServiceOrder) {
  const all = loadOrders().filter((o) => o.id !== order.id);
  all.unshift(order);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteOrder(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadOrders().filter((o) => o.id !== id)));
}

export function getOrder(id: string) {
  return loadOrders().find((o) => o.id === id);
}

export function nextNumber() {
  return loadOrders().reduce((m, o) => Math.max(m, o.number), 0) + 1;
}

export const statusLabel: Record<OrderStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Fechada",
};

// Compressão de imagens agora fica em lib/imagens (reexportada aqui para quem já importava daqui).
export { compressImage } from "./imagens";

export interface Company { name: string; logo: string | null; logo2?: string | null; logo3?: string | null; info: string }
const CKEY = "os-manutencao:company";
export function loadCompany(): Company {
  try { return { name: "", logo: null, info: "", ...JSON.parse(localStorage.getItem(CKEY) || "{}") }; } catch { return { name: "", logo: null, info: "" }; }
}
export function saveCompany(c: Company) { localStorage.setItem(CKEY, JSON.stringify(c)); }
