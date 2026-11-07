import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, X, Minus } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ReportPhotos } from "@/components/ReportPhotos";
import { exportElementToPdf } from "@/lib/pdf";
import { loadCompany, type Company } from "@/lib/orders";
import { deleteInspection, getInspection, resultLabel, fvsTotal, brl, parseNum, type FvsInspection } from "@/lib/fvs";

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

const resultIcon = { C: <Check className="h-5 w-5 text-success" strokeWidth={3} />, NC: <X className="h-5 w-5 text-destructive" strokeWidth={3} />, NA: <Minus className="h-5 w-5 text-warning" strokeWidth={3} /> };

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
        <button className="btn-primary" disabled={busy} onClick={async () => { if (!ref.current) return; setBusy(true); try { await exportElementToPdf(ref.current, `FVS-${num}.pdf`, [f.obra, f.local].filter(Boolean).join(" — ")); } catch { alert("Não foi possível gerar o PDF."); } finally { setBusy(false); } }}>{busy ? "Gerando..." : "Baixar PDF"}</button>
      </div>

      <article ref={ref} className="panel space-y-6">
        {company && (company.logo || company.logo2 || company.name) && (
          <div className="flex items-center gap-4">
            {company.logo && <CompanyLogo src={company.logo} />}
            <div>
              {company.name && <p className="font-display text-lg font-bold">{company.name}</p>}
              {company.info && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{company.info}</p>}
            </div>
            {company.logo2 && <div className="ml-auto"><CompanyLogo src={company.logo2} /></div>}
          </div>
        )}
        <header className="report-head">
          <p className="eyebrow">Ficha de Verificação de Serviço</p>
          <h1 className="font-display text-3xl font-bold">#{num} — {f.templateName}</h1>
          <p className="text-sm opacity-80">{new Date(f.createdAt).toLocaleString("pt-BR")}</p>
          <p className="mt-2 text-sm">Obra: {f.obra || "—"} · Local: {f.local || "—"} · Responsável: {f.responsavel || "—"}</p>
        </header>

        {(f.executor || f.crewList?.length || f.quantity || f.unitPrice) && (
          <section>
            <h2 className="report-section-title">Execução e medição</h2>
            {f.executor && <p className="mb-2 text-sm">Responsável pela execução: <b>{f.executor}</b></p>}
            {(f.crewList?.length || f.crew) && <p className="mb-2 text-sm">Efetivo: <b>{f.crewList?.length ? f.crewList.filter((m) => m.role || m.qty).map((m) => `${m.qty} ${m.role}`).join(", ") : `${f.crew} pessoa(s)`}</b></p>}
            <table className="report-table w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase"><th className="py-1">Unidade</th><th>Quantidade</th><th>Valor unit.</th><th className="text-right">Total</th></tr></thead>
              <tbody><tr><td className="py-2">{f.unit || "—"}</td><td>{f.quantity || "—"}</td><td>{brl(parseNum(f.unitPrice))}</td><td className="text-right font-bold">{brl(fvsTotal(f))}</td></tr></tbody>
            </table>
          </section>
        )}

        <section>
          <h2 className="report-section-title">Itens verificados</h2>
          <table className="report-table w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase"><th className="py-1">Item</th><th className="w-32 py-1">Resultado</th></tr></thead>
            <tbody>
              {f.items.map((it, k) => (
                <tr key={k} className="border-b border-border align-top">
                  <td className="py-2">{k + 1}. {it.text}{it.criteria && <p className="text-xs text-muted-foreground">Critério: {it.criteria}</p>}{it.note && <p className="text-xs text-muted-foreground">NC: {it.note}</p>}</td>
                  <td className={`py-2 font-semibold ${it.result === "NC" ? "text-destructive" : ""}`}>{it.result ? <span className="inline-flex items-center gap-1">{resultIcon[it.result]}{resultLabel[it.result]}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.observations && <p className="mt-3 whitespace-pre-wrap text-sm"><b>Observações:</b> {f.observations}</p>}
        </section>

        {f.photos.length > 0 && (
          <section>
            <h2 className="report-section-title">Fotos</h2>
            <ReportPhotos photos={f.photos} />
          </section>
        )}

        <section className="border-t border-border pt-4 pb-3" data-pdf-block>
          <h2 className="report-section-title">Responsável</h2>
          {f.signature ? <img src={f.signature} alt="Assinatura" className="h-32 w-full max-w-sm object-contain" /> : <div className="h-24 max-w-sm" />}
          <div className="max-w-sm border-t border-foreground pt-1 text-sm">{f.signedBy || "Assinatura do responsável"}</div>
        </section>
      </article>
    </main>
  );
}
