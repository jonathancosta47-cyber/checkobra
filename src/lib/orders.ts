export type OrderStatus = "aberta" | "em_andamento" | "concluida";

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
  concluida: "Concluída",
};

export function compressImage(file: File, max = 1200, type = "image/jpeg"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(type, 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface Company { name: string; logo: string | null; logo2?: string | null; info: string }
const CKEY = "os-manutencao:company";
export function loadCompany(): Company {
  try { return { name: "", logo: null, info: "", ...JSON.parse(localStorage.getItem(CKEY) || "{}") }; } catch { return { name: "", logo: null, info: "" }; }
}
export function saveCompany(c: Company) { localStorage.setItem(CKEY, JSON.stringify(c)); }
