import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Printer, Copy, Trash2, Pencil } from "lucide-react";
import { DeliveryAccess } from "@/components/DeliveryAccess";
import { DeliveryReport } from "@/components/DeliveryReport";
import { Button } from "@/components/ui/button";
import { readDelivery, removeDelivery } from "@/lib/delivery-store";
import { summaryText, type Delivery } from "@/lib/delivery";
import { exportElementToPdf } from "@/lib/pdf";
export const Route = createFileRoute("/entregas/$id")({
  head: () => ({
    meta: [
      { title: "Relatório de entrega de apartamento — CheckObra" },
      {
        name: "description",
        content: "Relatório técnico de entrega com checklist, fotos, pendências e assinaturas.",
      },
      { property: "og:title", content: "Relatório de entrega de apartamento — CheckObra" },
      {
        property: "og:description",
        content: "Visualize e exporte a vistoria de entrega da unidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 print:p-0">
      <div className="no-print">
        <Link to="/entregas" className="text-sm text-muted-foreground">
          ← Entregas
        </Link>
      </div>
      <DeliveryAccess>
        <Report id={id} />
      </DeliveryAccess>
    </main>
  );
}
function Report({ id }: { id: string }) {
  const [d, setD] = useState<Delivery | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const ref = useRef<HTMLElement>(null),
    nav = useNavigate();
  useEffect(() => {
    readDelivery(id)
      .then(setD)
      .catch(() => setError("Vistoria não encontrada ou acesso indisponível."));
  }, [id]);
  if (!d) return <p role="status">{error || "Carregando…"}</p>;
  return (
    <>
      <div className="no-print mb-5 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/entregas/nova" search={{ id }}>
            <Pencil />
            Editar
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            if (!ref.current) return;
            setBusy(true);
            setError("");
            try {
              await exportElementToPdf(
                ref.current,
                `Entrega-${d.unit.apartment.replace(/[^\w-]/g, "") || id.slice(0, 8)}.pdf`,
              );
            } catch {
              setError("Não foi possível gerar o PDF. Tente novamente.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download />
          {busy ? "Gerando…" : "Baixar PDF"}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(summaryText(d));
              setCopied(true);
            } catch {
              setError("Não foi possível copiar.");
            }
          }}
        >
          <Copy />
          {copied ? "Copiado" : "Copiar resultado"}
        </Button>
        <Button
          variant="ghost"
          aria-label="Excluir vistoria"
          title="Excluir vistoria"
          onClick={async () => {
            if (!confirm("Excluir esta vistoria?")) return;
            try {
              await removeDelivery(id);
              nav({ to: "/entregas" });
            } catch {
              setError("Não foi possível excluir.");
            }
          }}
        >
          <Trash2 />
        </Button>
        {error && (
          <p role="alert" className="w-full text-destructive">
            {error}
          </p>
        )}
      </div>
      <DeliveryReport ref={ref} delivery={d} />
    </>
  );
}
