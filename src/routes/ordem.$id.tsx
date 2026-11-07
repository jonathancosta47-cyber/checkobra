import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { exportElementToPdf } from "@/lib/pdf";
import { deleteOrder, getOrder, loadCompany, type Company, statusLabel, type ServiceOrder } from "@/lib/orders";

export const Route = createFileRoute("/ordem/$id")({
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
        <Link to="/" className="text-primary">Voltar</Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 print:p-0">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link to="/" className="mr-auto text-sm text-muted-foreground">← Voltar</Link>
        <Link to="/nova" search={{ id: o.id }} className="btn-ghost">Editar</Link>
        <button className="btn-ghost" onClick={() => { if (confirm("Excluir esta OS?")) { deleteOrder(o.id); nav({ to: "/" }); } }}>Excluir</button>
        <button className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
        <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await exportElementToPdf(docRef.current!, `OS-${String(o.number).padStart(4, "0")}.pdf`); } catch (e) { console.error(e); alert("Não foi possível gerar o PDF."); } finally { setBusy(false); } }}>{busy ? "Gerando..." : "Baixar PDF"}</button>
      </div>

      <article ref={docRef} className="panel space-y-6">
        {company && (company.logo || company.name) && (
          <div className="flex items-center gap-4">
            {company.logo && <CompanyLogo src={company.logo} />}
            <div>
              {company.name && <p className="font-display text-lg font-bold">{company.name}</p>}
              {company.info && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{company.info}</p>}
            </div>
          </div>
        )}
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

        {o.photos.length > 0 && (
          <section>
            <h2 className="report-section-title">Fotos</h2>
            <div className="grid grid-cols-3 gap-2">
              {o.photos.map((p, i) => (
                <img key={i} src={p} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
              ))}
            </div>
          </section>
        )}

        <section className="border-t border-border pt-4">
          <h2 className="report-section-title">Recebimento</h2>
          {o.signature ? (
            <img src={o.signature} alt="Assinatura" className="h-32 w-full max-w-sm object-contain" />
          ) : (
            <div className="h-24 max-w-sm" />
          )}
          <div className="max-w-sm border-t border-foreground pt-1 text-sm">{o.signedBy || "Assinatura do cliente"}</div>
        </section>
      </article>
    </main>
  );
}
