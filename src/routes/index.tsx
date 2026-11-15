import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrders, statusLabel, type ServiceOrder } from "@/lib/orders";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CheckObra — Ordens de Serviço e FVS" },
      { name: "description", content: "Crie ordens de serviço de manutenção com fotos, dados do cliente e assinatura." },
      { property: "og:title", content: "CheckObra — Ordens de Serviço e FVS" },
      { property: "og:description", content: "Gerador de ordens de serviço com fotos e assinatura digital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => setOrders(loadOrders()), []);
  const list = orders.filter((o) =>
    `${o.number} ${o.client.name} ${o.equipment}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">CheckObra</p>
          <h1 className="font-display text-4xl font-bold">Ordens de Serviço</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/entregas" className="btn-ghost">Entrega de apartamentos</Link>
          <Link to="/fvs" className="btn-ghost">Vistorias FVS</Link>
          <Link to="/empresa" className="btn-ghost">Minha empresa</Link>
        </div>
      </header>
      <input className="field mb-5" placeholder="Buscar por nº, cliente ou equipamento" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? (
        <div className="panel text-center text-muted-foreground">
          <p className="font-display text-lg text-foreground">Nenhuma ordem ainda</p>
          <p className="mt-1 text-sm">Toque em “Nova OS” para criar a primeira.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((o) => (
            <li key={o.id}>
              <Link to="/ordem/$id" params={{ id: o.id }} className="panel flex items-center gap-4 transition hover:border-primary">
                <span className="font-display text-2xl font-bold text-primary">#{String(o.number).padStart(4, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.client.name || "Sem cliente"}</p>
                  <p className="truncate text-sm text-muted-foreground">{o.equipment || "—"} · {new Date(o.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`badge badge-${o.status}`}>{statusLabel[o.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/nova" className="btn-primary fixed bottom-[calc(var(--obra-nav-altura)+env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 shadow-lg">+ Nova OS</Link>
    </main>
  );
}
