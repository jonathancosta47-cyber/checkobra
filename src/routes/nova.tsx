import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage, getOrder, nextNumber, saveOrder, type ServiceOrder } from "@/lib/orders";

export const Route = createFileRoute("/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Nova Ordem de Serviço" },
      { name: "description", content: "Preencha os dados do cliente, serviço, fotos e assinatura." },
      { property: "og:title", content: "Nova Ordem de Serviço" },
      { property: "og:description", content: "Crie uma nova OS de manutenção." },
    ],
  }),
  component: NewOrder,
});

const empty = (): ServiceOrder => ({
  id: crypto.randomUUID(),
  number: 0,
  createdAt: new Date().toISOString(),
  status: "aberta",
  client: { name: "", phone: "", email: "", document: "", address: "" },
  equipment: "",
  problem: "",
  service: "",
  technician: "",
  value: "",
  photos: [],
  signature: null,
  signedBy: "",
});

function NewOrder() {
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const [o, setO] = useState<ServiceOrder | null>(null);

  useEffect(() => {
    const existing = id ? getOrder(id) : undefined;
    setO(existing ?? { ...empty(), number: nextNumber() });
  }, [id]);

  if (!o) return null;
  const set = (patch: Partial<ServiceOrder>) => setO({ ...o, ...patch });
  const setC = (k: keyof ServiceOrder["client"], v: string) => setO({ ...o, client: { ...o.client, [k]: v } });

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const imgs = await Promise.all(Array.from(files).map((f) => compressImage(f)));
    setO((cur) => (cur ? { ...cur, photos: [...cur.photos, ...imgs] } : cur));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      saveOrder(o);
      nav({ to: "/ordem/$id", params: { id: o.id } });
    } catch {
      alert("Armazenamento cheio. Remova algumas fotos ou ordens antigas.");
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link to="/" className="text-sm text-muted-foreground">← Voltar</Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">
        OS <span className="text-primary">#{String(o.number).padStart(4, "0")}</span>
      </h1>
      <form onSubmit={submit} className="space-y-5">
        <section className="panel space-y-3">
          <h2 className="eyebrow">Cliente</h2>
          <input required className="field" placeholder="Nome *" value={o.client.name} onChange={(e) => setC("name", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" type="tel" placeholder="Telefone" value={o.client.phone} onChange={(e) => setC("phone", e.target.value)} />
            <input className="field" type="email" placeholder="E-mail" value={o.client.email} onChange={(e) => setC("email", e.target.value)} />
          </div>
          <input className="field" placeholder="CPF / CNPJ" value={o.client.document} onChange={(e) => setC("document", e.target.value)} />
          <input className="field" placeholder="Endereço" value={o.client.address} onChange={(e) => setC("address", e.target.value)} />
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Serviço</h2>
          <input className="field" placeholder="Equipamento / local" value={o.equipment} onChange={(e) => set({ equipment: e.target.value })} />
          <textarea className="field min-h-24" placeholder="Problema relatado" value={o.problem} onChange={(e) => set({ problem: e.target.value })} />
          <textarea className="field min-h-24" placeholder="Serviço executado" value={o.service} onChange={(e) => set({ service: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="field" placeholder="Técnico" value={o.technician} onChange={(e) => set({ technician: e.target.value })} />
            <input className="field" inputMode="decimal" placeholder="Valor (R$)" value={o.value} onChange={(e) => set({ value: e.target.value })} />
            <select className="field" value={o.status} onChange={(e) => set({ status: e.target.value as ServiceOrder["status"] })}>
              <option value="aberta">Aberta</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Fotos</h2>
          <div className="grid grid-cols-3 gap-2">
            {o.photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md">
                <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => set({ photos: o.photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-foreground/80 px-2 text-sm text-background">×</button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-sm text-muted-foreground">
              <span className="text-2xl text-primary">+</span>Adicionar
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Assinatura de recebimento</h2>
          <input className="field" placeholder="Nome de quem recebeu" value={o.signedBy} onChange={(e) => set({ signedBy: e.target.value })} />
          <SignaturePad value={o.signature} onChange={(signature) => setO((cur) => (cur ? { ...cur, signature } : cur))} />
        </section>

        <button type="submit" className="btn-primary w-full">Salvar ordem de serviço</button>
      </form>
    </main>
  );
}
