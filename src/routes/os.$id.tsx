import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CompanyHeader } from "@/components/CompanyHeader";
import { ReportPhotos } from "@/components/ReportPhotos";
import { exportElementToPdf } from "@/lib/pdf";
import { OrderCheckIcon } from "@/components/OrderCheckIcon";
import { checkLabel, deleteOrder, getOrder, loadCompany, type Company, statusLabel, type ServiceOrder } from "@/lib/orders";

export const Route = createFileRoute("/os/$id")({
  head: () => ({
    meta: [
      { title: "Ordem de Serviço — Detalhes" },
      { name: "description", content: "Visualize, imprima ou compartilhe a ordem de serviço em PDF." },
      { property: "og:title", content: "Ordem de Serviço — Detalhes" },
      { property: "og:description", content: "Detalhes da ordem de serviço de manutenção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderView,
});

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function OrderView() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [o, setO] = useState<ServiceOrder | null | undefined>(undefined);
  useEffect(() => setO(getOrder(id) ?? null), [id]);
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => setCompany(loadCompany()), []);
  const docRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);

  if (o === undefined) return null;
  if (o === null)
    return (
      <main className="p-8 text-center">
        <p>Ordem não encontrada.</p>
        <Link to="/os" className="text-obra-laranja-texto">Voltar para OS</Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5 print:p-0">
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/os/nova" search={{ id: o.id }} className="btn-ghost">Editar</Link>
        <button className="btn-ghost" onClick={() => { if (confirm("Excluir esta OS?")) { deleteOrder(o.id); nav({ to: "/os" }); } }}>Excluir</button>
        <button className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
        <button className="btn-primary" disabled={busy} onClick={async () => { if (!docRef.current) return; setBusy(true); try { await exportElementToPdf(docRef.current, `OS-${String(o.number).padStart(4, "0")}.pdf`, o.client.address || o.client.name); } catch (e) { console.error(e); alert("Não foi possível gerar o PDF."); } finally { setBusy(false); } }}>{busy ? "Gerando..." : "Baixar PDF"}</button>
      </div>

      <article ref={docRef} className="panel space-y-6">
        <CompanyHeader company={company} />
        <header className="report-head flex items-start justify-between">
          <div>
            <p className="eyebrow">Ordem de Serviço</p>
            <h1 className="font-display text-3xl font-bold">#{String(o.number).padStart(4, "0")}</h1>
            <p className="text-sm opacity-80">{new Date(o.createdAt).toLocaleString("pt-BR")}</p>
          </div>
          <span className={`badge badge-${o.status}`}>{statusLabel[o.status]}</span>
        </header>

        <section>
          <h2 className="report-section-title">Cliente</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Nome" value={o.client.name} />
            <Row label="CPF / CNPJ" value={o.client.document} />
            <Row label="Telefone" value={o.client.phone} />
            <Row label="E-mail" value={o.client.email} />
            <Row label="Endereço" value={o.client.address} />
          </dl>
        </section>

        <section>
          <h2 className="report-section-title">Serviço</h2>
          <dl className="grid gap-3">
            <Row label="Equipamento / local" value={o.equipment} />
            <Row label="Problema relatado" value={o.problem} />
            <Row label="Serviço executado" value={o.service} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Técnico" value={o.technician} />
              <Row label="Valor" value={o.value ? `R$ ${o.value}` : ""} />
            </div>
          </dl>
        </section>

        {(o.checks ?? []).some((c) => c.text) && (
          <section>
            <h2 className="report-section-title">Checklist do serviço</h2>
            <table className="report-table w-full text-sm">
              <thead><tr><th className="text-left">Item</th><th className="text-left">Situação</th></tr></thead>
              <tbody>
                {(o.checks ?? []).filter((c) => c.text).map((c, k) => (
                  <tr key={k}>
                    <td className="py-2">{c.text}</td>
                    <td className="py-2 font-semibold">{c.result ? <span className="inline-flex items-center gap-1"><OrderCheckIcon r={c.result} />{checkLabel[c.result]}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {o.photos.length > 0 && (
          <section>
            <h2 className="report-section-title">Fotos</h2>
            <ReportPhotos photos={o.photos} />
          </section>
        )}

        <section className="border-t border-border pt-4 pb-3" data-pdf-block>
          <h2 className="report-section-title">Assinaturas</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { img: o.signature, name: o.signedBy, role: "Cliente" },
              { img: o.openerSignature, name: o.openerName, role: "Responsável pela abertura" },
              { img: o.techSignature, name: o.technician, role: "Técnico responsável" },
            ].map((s) => (
              <div key={s.role}>
                {s.img ? <img src={s.img} alt={`Assinatura ${s.role}`} className="h-24 w-full object-contain" /> : <div className="h-24" />}
                <div className="border-t border-foreground pt-1 text-sm">{s.name || "\u00A0"}</div>
                <p className="text-xs text-muted-foreground">{s.role}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
