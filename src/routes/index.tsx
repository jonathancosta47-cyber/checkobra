import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrders, statusLabel, type ServiceOrder } from "@/lib/orders";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço — Manutenção" },
      { name: "description", content: "Crie ordens de serviço de manutenção com fotos, dados do cliente e assinatura." },
      { property: "og:title", content: "Ordens de Serviço — Manutenção" },
      { property: "og:description", content: "Gerador de ordens de serviço com fotos e assinatura digital." },
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
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Manutenção</p>
          <h1 className="font-display text-4xl font-bold">Ordens de Serviço</h1>
        </div>
        <div className="flex gap-2">
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
      <Link to="/nova" className="btn-primary fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg">+ Nova OS</Link>
    </main>
  );
}
