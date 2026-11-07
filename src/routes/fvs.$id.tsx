import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { exportElementToPdf } from "@/lib/pdf";
import { loadCompany, type Company } from "@/lib/orders";
import { deleteInspection, getInspection, resultLabel, type FvsInspection } from "@/lib/fvs";

export const Route = createFileRoute("/fvs/$id")({
  head: () => ({
    meta: [
      { title: "FVS — Detalhes da vistoria" },
      { name: "description", content: "Visualize, imprima ou baixe a FVS em PDF." },
      { property: "og:title", content: "FVS — Detalhes da vistoria" },
      { property: "og:description", content: "Ficha de verificação de serviço da obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FvsView,
});

function FvsView() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [f, setF] = useState<FvsInspection | null | undefined>(undefined);
  const [company, setCompany] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { setF(getInspection(id) ?? null); setCompany(loadCompany()); }, [id]);

  if (f === undefined) return null;
  if (f === null) return <main className="p-8 text-center"><p>Vistoria não encontrada.</p><Link to="/fvs" className="text-primary">Voltar</Link></main>;
  const num = String(f.number).padStart(4, "0");

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 print:p-0">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link to="/fvs" className="mr-auto text-sm text-muted-foreground">← Voltar</Link>
        <Link to="/fvs/nova" search={{ id: f.id }} className="btn-ghost">Editar</Link>
        <button className="btn-ghost" onClick={() => { if (confirm("Excluir esta FVS?")) { deleteInspection(f.id); nav({ to: "/fvs" }); } }}>Excluir</button>
        <button className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
        <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await exportElementToPdf(ref.current!, `FVS-${num}.pdf`); } catch { alert("Não foi possível gerar o PDF."); } finally { setBusy(false); } }}>{busy ? "Gerando..." : "Baixar PDF"}</button>
      </div>

      <article ref={ref} className="panel space-y-6">
        {company && (company.logo || company.name) && (
          <div className="flex items-center gap-4">
            {company.logo && <CompanyLogo src={company.logo} />}
            <div>
              {company.name && <p className="font-display text-lg font-bold">{company.name}</p>}
              {company.info && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{company.info}</p>}
            </div>
          </div>
        )}
        <header className="border-b border-border pb-4">
          <p className="eyebrow">Ficha de Verificação de Serviço</p>
          <h1 className="font-display text-3xl font-bold">#{num} — {f.templateName}</h1>
          <p className="text-sm text-muted-foreground">{new Date(f.createdAt).toLocaleString("pt-BR")}</p>
          <p className="mt-2 text-sm">Obra: {f.obra || "—"} · Local: {f.local || "—"} · Responsável: {f.responsavel || "—"}</p>
        </header>

        <section>
          <h2 className="eyebrow mb-2">Itens verificados</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-1">Item</th><th className="w-32 py-1">Resultado</th></tr></thead>
            <tbody>
              {f.items.map((it, k) => (
                <tr key={k} className="border-b border-border align-top">
                  <td className="py-2">{k + 1}. {it.text}{it.note && <p className="text-xs text-muted-foreground">NC: {it.note}</p>}</td>
                  <td className={`py-2 font-semibold ${it.result === "NC" ? "text-destructive" : ""}`}>{it.result ? resultLabel[it.result] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.observations && <p className="mt-3 whitespace-pre-wrap text-sm"><b>Observações:</b> {f.observations}</p>}
        </section>

        {f.photos.length > 0 && (
          <section>
            <h2 className="eyebrow mb-2">Fotos</h2>
            <div className="grid grid-cols-3 gap-2">{f.photos.map((p, i) => <img key={i} src={p} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />)}</div>
          </section>
        )}

        <section className="border-t border-border pt-4">
          <h2 className="eyebrow mb-2">Responsável</h2>
          {f.signature ? <img src={f.signature} alt="Assinatura" className="h-32 w-full max-w-sm object-contain" /> : <div className="h-24 max-w-sm" />}
          <div className="max-w-sm border-t border-foreground pt-1 text-sm">{f.signedBy || "Assinatura do responsável"}</div>
        </section>
      </article>
    </main>
  );
}
