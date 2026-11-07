import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, Minus } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage } from "@/lib/orders";
import { getInspection, loadTemplates, nextFvsNumber, fvsTotal, brl, loadContractors, findContract, type Contractor, saveInspection, type FvsInspection, type FvsResult, type FvsTemplate } from "@/lib/fvs";

export const Route = createFileRoute("/fvs/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Nova FVS — Vistoria de obra" },
      { name: "description", content: "Preencha a ficha de verificação de serviço da obra." },
      { property: "og:title", content: "Nova FVS — Vistoria de obra" },
      { property: "og:description", content: "Checklist de vistoria com fotos e assinatura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewFvs,
});

const opts: { v: Exclude<FvsResult, null>; l: string }[] = [{ v: "C", l: "C" }, { v: "NC", l: "NC" }, { v: "NA", l: "N/A" }];

const resultIcon = { C: <Check className="h-5 w-5 text-success" strokeWidth={3} />, NC: <X className="h-5 w-5 text-destructive" strokeWidth={3} />, NA: <Minus className="h-5 w-5 text-warning" strokeWidth={3} /> };

function NewFvs() {
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<FvsTemplate[]>([]);
  const [f, setF] = useState<FvsInspection | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  useEffect(() => {
    setTemplates(loadTemplates());
    setContractors(loadContractors());
    const ex = id ? getInspection(id) : undefined;
    setF(ex ?? { id: crypto.randomUUID(), number: nextFvsNumber(), createdAt: new Date().toISOString(), templateName: "", obra: "", local: "", responsavel: "", items: [], observations: "", photos: [], signature: null, signedBy: "" });
  }, [id]);

  if (!f) return null;
  const set = (p: Partial<FvsInspection>) => setF((c) => {
    if (!c) return c;
    const n = { ...c, ...p };
    if ("executor" in p || "templateName" in p) {
      const k = findContract(contractors, n.executor, n.templateName);
      if (k) { n.unit = k.unit; n.unitPrice = k.unitPrice; }
    }
    return n;
  });
  const pick = (tid: string) => {
    const t = templates.find((x) => x.id === tid);
    if (t) set({ templateName: t.name, items: t.items.map((text, k) => ({ text, result: null, note: "", criteria: t.criteria?.[k] || "" })) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.templateName) return alert("Escolha um modelo de FVS.");
    try { saveInspection(f); nav({ to: "/fvs/$id", params: { id: f.id } }); }
    catch { alert("Armazenamento cheio. Remova algumas fotos ou vistorias antigas."); }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link to="/fvs" className="text-sm text-muted-foreground">← Voltar</Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">FVS <span className="text-primary">#{String(f.number).padStart(4, "0")}</span></h1>
      <form onSubmit={submit} className="space-y-5">
        <section className="panel space-y-3">
          <h2 className="eyebrow">Identificação</h2>
          <select className="field" value={templates.find((t) => t.name === f.templateName)?.id ?? ""} onChange={(e) => pick(e.target.value)}>
            <option value="" disabled>{f.templateName || "Escolha o serviço (modelo de FVS) *"}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Link to="/fvs/modelos" className="text-sm text-primary">Criar ou editar modelos de FVS →</Link>
          <input className="field" placeholder="Obra" value={f.obra} onChange={(e) => set({ obra: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" placeholder="Local (bloco, pavimento, unidade)" value={f.local} onChange={(e) => set({ local: e.target.value })} />
            <input className="field" placeholder="Responsável pela vistoria" value={f.responsavel} onChange={(e) => set({ responsavel: e.target.value })} />
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Execução e medição</h2>
          <input className="field" list="empreiteiros" placeholder="Responsável pela execução (empreiteiro)" value={f.executor ?? ""} onChange={(e) => set({ executor: e.target.value })} />
          <datalist id="empreiteiros">{contractors.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          {f.executor && f.templateName && (findContract(contractors, f.executor, f.templateName)
            ? <p className="text-xs text-primary">Valores preenchidos pelo contrato do empreiteiro.</p>
            : <p className="text-xs text-muted-foreground">Sem contrato para este serviço. <Link to="/empreiteiros" className="text-primary">Cadastrar empreiteiros →</Link></p>)}
          <h3 className="eyebrow">Efetivo na atividade</h3>
          {(f.crewList ?? []).map((m, k) => (
            <div key={k} className="grid grid-cols-[5rem_1fr_auto] gap-2">
              <input className="field" inputMode="numeric" placeholder="Qtd" value={m.qty} onChange={(e) => set({ crewList: (f.crewList ?? []).map((x, j) => (j === k ? { ...x, qty: e.target.value } : x)) })} />
              <input className="field" list="funcoes" placeholder="Função (ex: Pedreiro)" value={m.role} onChange={(e) => set({ crewList: (f.crewList ?? []).map((x, j) => (j === k ? { ...x, role: e.target.value } : x)) })} />
              <button type="button" className="btn-ghost" aria-label="Remover" onClick={() => set({ crewList: (f.crewList ?? []).filter((_, j) => j !== k) })}>×</button>
            </div>
          ))}
          <datalist id="funcoes">{["Pedreiro", "Servente", "Carpinteiro", "Armador", "Eletricista", "Encanador", "Pintor", "Azulejista"].map((r) => <option key={r} value={r} />)}</datalist>
          <button type="button" className="btn-ghost" onClick={() => set({ crewList: [...(f.crewList ?? []), { qty: "1", role: "" }] })}>+ Função</button>
          <div className="grid grid-cols-3 gap-3">
            <input className="field" placeholder="Unidade (m²)" value={f.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} />
            <input className="field" inputMode="decimal" placeholder="Quantidade" value={f.quantity ?? ""} onChange={(e) => set({ quantity: e.target.value })} />
            <input className="field" inputMode="decimal" placeholder="Valor unit. (R$)" value={f.unitPrice ?? ""} onChange={(e) => set({ unitPrice: e.target.value })} />
          </div>
          <p className="text-right font-display text-xl font-bold">Total: <span className="text-primary">{brl(fvsTotal(f))}</span></p>
        </section>

        {f.items.length > 0 && (
          <section className="panel space-y-4">
            <h2 className="eyebrow">Verificação — C: conforme · NC: não conforme · N/A</h2>
            {f.items.map((it, k) => (
              <div key={k} className="space-y-2 border-b border-border pb-3 last:border-0">
                <p className="font-medium">{k + 1}. {it.text}</p>
                {it.criteria && <p className="text-xs text-muted-foreground">Critério: {it.criteria}</p>}
                <div className="flex gap-2">
                  {opts.map((o) => (
                    <button type="button" key={o.v} onClick={() => set({ items: f.items.map((x, m) => (m === k ? { ...x, result: x.result === o.v ? null : o.v } : x)) })}
                      className={`btn-ghost flex-1 justify-center gap-1 ${it.result === o.v ? (o.v === "C" ? "border-success bg-success/15" : o.v === "NC" ? "border-destructive bg-destructive/15" : "border-warning bg-warning/20") : ""}`}>{resultIcon[o.v]}{o.l}</button>
                  ))}
                </div>
                {it.result === "NC" && (
                  <input className="field" placeholder="Descreva a não conformidade" value={it.note} onChange={(e) => set({ items: f.items.map((x, m) => (m === k ? { ...x, note: e.target.value } : x)) })} />
                )}
              </div>
            ))}
            <textarea className="field min-h-20" placeholder="Observações gerais" value={f.observations} onChange={(e) => set({ observations: e.target.value })} />
          </section>
        )}

        <section className="panel space-y-3">
          <h2 className="eyebrow">Fotos</h2>
          <div className="grid grid-cols-3 gap-2">
            {f.photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md">
                <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => set({ photos: f.photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-foreground/80 px-2 text-sm text-background">×</button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-sm text-muted-foreground">
              <span className="text-2xl text-primary">+</span>Adicionar
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = e.target.files; if (!files) return;
                const imgs = await Promise.all(Array.from(files).map((x) => compressImage(x)));
                setF((c) => (c ? { ...c, photos: [...c.photos, ...imgs] } : c));
              }} />
            </label>
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Assinatura do responsável</h2>
          <input className="field" placeholder="Nome de quem assina" value={f.signedBy} onChange={(e) => set({ signedBy: e.target.value })} />
          <SignaturePad value={f.signature} onChange={(signature) => set({ signature })} />
        </section>

        <button type="submit" className="btn-primary w-full">Salvar FVS</button>
      </form>
    </main>
  );
}
