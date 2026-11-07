import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadInspections, type FvsInspection } from "@/lib/fvs";

export const Route = createFileRoute("/fvs/")({
  head: () => ({
    meta: [
      { title: "FVS — Fichas de Verificação de Serviço" },
      { name: "description", content: "Vistorias FVS para obras com checklist, fotos e assinatura." },
      { property: "og:title", content: "FVS — Fichas de Verificação de Serviço" },
      { property: "og:description", content: "Vistorias de obra com checklist e assinatura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FvsList,
});

function FvsList() {
  const [list, setList] = useState<FvsInspection[]>([]);
  useEffect(() => setList(loadInspections()), []);
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-6">
      <Link to="/" className="text-sm text-muted-foreground">← Ordens de serviço</Link>
      <header className="mb-6 mt-2 flex items-end justify-between gap-3">
        <div><p className="eyebrow">Obras</p><h1 className="font-display text-4xl font-bold">Vistorias FVS</h1></div>
        <Link to="/fvs/modelos" className="btn-ghost">Modelos de FVS</Link>
      </header>
      {list.length === 0 ? (
        <div className="panel text-center text-muted-foreground">
          <p className="font-display text-lg text-foreground">Nenhuma vistoria ainda</p>
          <p className="mt-1 text-sm">Toque em “Nova FVS” para começar.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => {
            const nc = i.items.filter((x) => x.result === "NC").length;
            return (
              <li key={i.id}>
                <Link to="/fvs/$id" params={{ id: i.id }} className="panel flex items-center gap-4 transition hover:border-primary">
                  <span className="font-display text-2xl font-bold text-primary">#{String(i.number).padStart(4, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.templateName}</p>
                    <p className="truncate text-sm text-muted-foreground">{i.obra || "—"} · {i.local || "—"} · {new Date(i.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`badge ${nc ? "badge-aberta" : "badge-concluida"}`}>{nc ? `${nc} NC` : "OK"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/fvs/nova" className="btn-primary fixed bottom-6 left-1/2 -translate-x-1/2 shadow-lg">+ Nova FVS</Link>
    </main>
  );
}
