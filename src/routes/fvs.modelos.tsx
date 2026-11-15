import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadTemplates, saveTemplates, type FvsTemplate } from "@/lib/fvs";

export const Route = createFileRoute("/fvs/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de FVS" },
      { name: "description", content: "Crie e edite modelos de Fichas de Verificação de Serviço." },
      { property: "og:title", content: "Modelos de FVS" },
      { property: "og:description", content: "Crie e edite checklists de FVS para obras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Templates,
});

function Templates() {
  const [list, setList] = useState<FvsTemplate[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => setList(loadTemplates()), []);
  const update = (i: number, t: FvsTemplate) => { setSaved(false); setList(list.map((x, j) => (j === i ? t : x))); };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <div className="space-y-5">
        {list.map((t, i) => (
          <section key={t.id} className="panel space-y-3">
            <div className="flex gap-2">
              <input className="field flex-1 font-semibold" placeholder="Nome do serviço (ex: Reboco)" value={t.name} onChange={(e) => update(i, { ...t, name: e.target.value })} />
              <button type="button" className="btn-ghost" onClick={() => { if (confirm("Excluir este modelo?")) { setSaved(false); setList(list.filter((_, j) => j !== i)); } }}>Excluir</button>
            </div>
            <h2 className="eyebrow">Itens a verificar · critério / tolerância</h2>
            {t.items.map((it, k) => (
              <div key={k} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className="field" value={it} placeholder={`Item ${k + 1}`} onChange={(e) => update(i, { ...t, items: t.items.map((x, m) => (m === k ? e.target.value : x)) })} />
                <input className="field" value={t.criteria?.[k] ?? ""} placeholder="Tolerância (ex: até 2 cm)" onChange={(e) => { const c = t.items.map((_, m) => t.criteria?.[m] ?? ""); c[k] = e.target.value; update(i, { ...t, criteria: c }); }} />
                <button type="button" className="btn-ghost" aria-label="Remover item" onClick={() => update(i, { ...t, items: t.items.filter((_, m) => m !== k), criteria: (t.criteria ?? []).filter((_, m) => m !== k) })}>×</button>
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => update(i, { ...t, items: [...t.items, ""], criteria: [...t.items.map((_, m) => t.criteria?.[m] ?? ""), ""] })}>+ Item</button>
          </section>
        ))}
        <button type="button" className="btn-ghost w-full" onClick={() => { setSaved(false); setList([...list, { id: crypto.randomUUID(), name: "", items: [""] }]); }}>+ Novo modelo de FVS</button>
        <button type="button" className="btn-primary w-full" onClick={() => {
          saveTemplates(list.map((t) => ({ ...t, name: t.name.trim() || "Sem nome", ...(() => { const keep = t.items.map((x, k): [string, string] => [x.trim(), (t.criteria?.[k] ?? "").trim()]).filter(([x]) => x); return { items: keep.map((x) => x[0]), criteria: keep.map((x) => x[1]) }; })() })));
          setList(loadTemplates()); setSaved(true);
        }}>{saved ? "Salvo ✓" : "Salvar modelos"}</button>
      </div>
    </main>
  );
}
