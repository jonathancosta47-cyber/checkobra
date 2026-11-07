import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadContractors, loadTemplates, saveContractors, type Contractor, type FvsTemplate } from "@/lib/fvs";

export const Route = createFileRoute("/empreiteiros")({
  head: () => ({
    meta: [
      { title: "Empreiteiros e contratos — CheckObra" },
      { name: "description", content: "Cadastre empreiteiros e os valores unitários de cada serviço contratado." },
      { property: "og:title", content: "Empreiteiros e contratos — CheckObra" },
      { property: "og:description", content: "Valores de contrato por serviço para medição de empreiteiros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contractors,
});

function Contractors() {
  const [list, setList] = useState<Contractor[]>([]);
  const [templates, setTemplates] = useState<FvsTemplate[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setList(loadContractors()); setTemplates(loadTemplates()); }, []);
  const upd = (i: number, c: Contractor) => { setSaved(false); setList(list.map((x, j) => (j === i ? c : x))); };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link to="/fvs" className="text-sm text-muted-foreground">← Vistorias FVS</Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">Empreiteiros</h1>
      <datalist id="servicos">{templates.map((t) => <option key={t.id} value={t.name} />)}</datalist>
      <div className="space-y-5">
        {list.map((c, i) => (
          <section key={c.id} className="panel space-y-3">
            <div className="flex gap-2">
              <input className="field flex-1 font-semibold" placeholder="Nome do empreiteiro" value={c.name} onChange={(e) => upd(i, { ...c, name: e.target.value })} />
              <button type="button" className="btn-ghost" onClick={() => { if (confirm("Excluir este empreiteiro?")) { setSaved(false); setList(list.filter((_, j) => j !== i)); } }}>Excluir</button>
            </div>
            <h2 className="eyebrow">Contratos (serviço · unidade · valor unitário)</h2>
            {c.contracts.map((k, m) => {
              const setK = (p: Partial<typeof k>) => upd(i, { ...c, contracts: c.contracts.map((x, n) => (n === m ? { ...x, ...p } : x)) });
              return (
                <div key={m} className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2">
                  <input className="field" list="servicos" placeholder="Serviço (ex: Alvenaria)" value={k.service} onChange={(e) => setK({ service: e.target.value })} />
                  <input className="field" placeholder="m²" value={k.unit} onChange={(e) => setK({ unit: e.target.value })} />
                  <input className="field" inputMode="decimal" placeholder="R$" value={k.unitPrice} onChange={(e) => setK({ unitPrice: e.target.value })} />
                  <button type="button" className="btn-ghost" aria-label="Remover contrato" onClick={() => upd(i, { ...c, contracts: c.contracts.filter((_, n) => n !== m) })}>×</button>
                </div>
              );
            })}
            <button type="button" className="btn-ghost" onClick={() => upd(i, { ...c, contracts: [...c.contracts, { service: "", unit: "m²", unitPrice: "" }] })}>+ Contrato</button>
          </section>
        ))}
        <button type="button" className="btn-ghost w-full" onClick={() => { setSaved(false); setList([...list, { id: crypto.randomUUID(), name: "", contracts: [{ service: "", unit: "m²", unitPrice: "" }] }]); }}>+ Novo empreiteiro</button>
        <button type="button" className="btn-primary w-full" onClick={() => { saveContractors(list.filter((c) => c.name.trim())); setList(loadContractors()); setSaved(true); }}>{saved ? "Salvo ✓" : "Salvar empreiteiros"}</button>
      </div>
    </main>
  );
}
