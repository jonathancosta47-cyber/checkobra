import { forwardRef, useEffect, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ReportPhotos } from "@/components/ReportPhotos";
import { DeliveryEvaluation } from "./DeliveryEvaluation";
import { documentLabels, issuesOf, pendingCount, type Delivery } from "@/lib/delivery";
import { loadCompany, type Company } from "@/lib/orders";
export const unitLabels: Record<keyof Delivery["unit"], string> = {
  development: "Empreendimento",
  tower: "Torre / Bloco",
  apartment: "Apartamento",
  floor: "Pavimento",
  area: "Área privativa (m²)",
  date: "Data da vistoria",
  inspector: "Responsável pela vistoria",
  representative: "Representante da obra",
  buyer: "Cliente / Comprador",
};
export const DeliveryReport = forwardRef<HTMLElement, { delivery: Delivery }>(
  ({ delivery: d }, ref) => {
    const [company, setCompany] = useState<Company | null>(null);
    useEffect(() => setCompany(loadCompany()), []);
    return (
      <article
        ref={ref}
        className="delivery-report space-y-6 bg-card p-5 text-card-foreground sm:p-7"
      >
        {company && (company.logo || company.name) && (
          <div className="flex flex-wrap items-center gap-4" data-pdf-block>
            {company.logo && <CompanyLogo src={company.logo} />}
            <div>
              <p className="text-lg font-bold">{company.name}</p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{company.info}</p>
            </div>
          </div>
        )}
        <header className="report-head" data-pdf-block>
          <p className="text-sm">CheckObra · Vistoria técnica</p>
          <h1 className="text-2xl font-bold">Entrega de apartamento</h1>
          <p className="mt-1">
            {d.unit.development || "—"} · Apartamento {d.unit.apartment || "—"}
          </p>
        </header>
        <section>
          <h2 className="report-section-title" data-pdf-block>
            Identificação da unidade
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(unitLabels).map(([key, label]) => (
              <div key={key} data-pdf-block>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="break-words font-semibold">
                  {d.unit[key as keyof Delivery["unit"]] || "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
        {d.rooms.map((room) => (
          <section key={room.id}>
            <h2 className="report-section-title" data-pdf-block>
              {room.name}
            </h2>
            <table className="report-table w-full text-sm">
              <thead>
                <tr data-pdf-block>
                  <th className="py-2 text-left">Item de inspeção</th>
                  <th className="w-36 text-left">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {room.items.map((item) => (
                  <tr key={item.id} data-pdf-block className="border-b border-border align-top">
                    <td className="py-2">
                      {item.text}
                      {item.criteria && (
                        <p className="text-xs text-muted-foreground">
                          Critério / tolerância: {item.criteria}
                        </p>
                      )}
                    </td>
                    <td className="py-2">
                      <DeliveryEvaluation value={item.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <section>
          <h2 className="report-section-title" data-pdf-block>
            Controle de não conformidades · {issuesOf(d).length}
          </h2>
          {issuesOf(d).map(({ room, item }, i) => (
            <div key={item.id} className="mb-4 border-b border-border pb-3">
              <div data-pdf-block>
                <p className="font-bold">
                  {String(i + 1).padStart(2, "0")} · {room} · {item.text}
                </p>
                <p className="whitespace-pre-wrap text-sm">{item.description}</p>
                <p className="text-sm">
                  Localização: {item.location} · Classificação: {item.severity || "Não definida"}
                </p>
                <p className="text-sm">
                  Responsável: {item.owner} · Prazo: {item.deadline} · Status: {item.status}
                </p>
              </div>
              <div className="mt-2">
                <ReportPhotos photos={item.photos} label={`Pendência ${i + 1}, foto`} />
              </div>
            </div>
          ))}
          {!issuesOf(d).length && <p data-pdf-block>Nenhuma não conformidade registrada.</p>}
        </section>
        <section>
          <h2 className="report-section-title" data-pdf-block>
            Documentação para entrega
          </h2>
          {documentLabels.map((text, i) => (
            <p key={text} className="flex items-center gap-2 py-1 text-sm" data-pdf-block>
              <DeliveryEvaluation value={d.documents[i] ? "C" : "PT"} label={false} />
              {text}
            </p>
          ))}
        </section>
        <section>
          <h2 className="report-section-title" data-pdf-block>
            Resultado da vistoria
          </h2>
          <div data-pdf-block>
            <p className="text-lg font-bold">{d.result || "Não definido"}</p>
            <p>Pendências em aberto: {pendingCount(d)}</p>
            <p className="whitespace-pre-wrap text-sm">
              {d.observations || "Sem observações gerais."}
            </p>
          </div>
        </section>
        {d.photos.length > 0 && (
          <section>
            <h2 className="report-section-title" data-pdf-block>
              Registro fotográfico final
            </h2>
            <ReportPhotos photos={d.photos} label="Registro final" />
          </section>
        )}
        <section data-pdf-block className="pb-3">
          <h2 className="report-section-title">
            Assinaturas
          </h2>
          <div className="grid gap-5 pb-2 sm:grid-cols-3">
            {d.signatures.map((s) => (
              <div key={s.role} data-pdf-block>
                {s.image ? (
                  <img
                    src={s.image}
                    alt={`Assinatura: ${s.role}`}
                    className="h-28 w-full object-contain"
                  />
                ) : (
                  <div className="h-28" />
                )}
                <p className="border-t border-border pt-1 font-semibold">
                  {s.name || (s.image ? "Nome não informado" : "Não assinado")}
                </p>
                <p className="text-xs text-muted-foreground">{s.role}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    );
  },
);
DeliveryReport.displayName = "DeliveryReport";
