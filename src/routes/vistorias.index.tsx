import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";
import type { Empreendimento } from "@/lib/empreendimentos";
import { listDeliveries } from "@/lib/delivery-store";
import { pendingCount, type Delivery } from "@/lib/delivery";
import { filtrarVistorias, progressoVistoria, type FiltroPendencia } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, Vazio } from "@/components/modulos";

export const Route = createFileRoute("/vistorias/")({
  head: () => ({
    meta: [
      { title: "Vistorias de entrega — CheckObra" },
      { name: "description", content: "Controle a vistoria e a liberação de unidades residenciais." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <ComEmpreendimento>{(emp) => <List key={emp.id} emp={emp} />}</ComEmpreendimento>
    </Pagina>
  );
}

const FILTROS: { v: FiltroPendencia; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "com", l: "Com pendências" },
  { v: "sem", l: "Sem pendências" },
];

function List({ emp }: { emp: Empreendimento }) {
  const [list, setList] = useState<Delivery[]>([]),
    [q, setQ] = useState(""),
    [pendencia, setPendencia] = useState<FiltroPendencia>("todas"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    listDeliveries(emp.id)
      .then(setList)
      .catch(() => setError("Não foi possível carregar as vistorias."))
      .finally(() => setLoading(false));
  }, [emp.id]);
  const lista = filtrarVistorias(list, { q, pendencia });

  return (
    <div>
      <BuscaCard label="Buscar vistorias" placeholder="Torre, apartamento ou cliente" value={q} onChange={setQ} />
      <div className="mt-4 space-y-3">
        <Pilulas label="Filtrar por pendências" opcoes={FILTROS} valor={pendencia} onChange={setPendencia} />
      </div>
      {error && (
        <p role="alert" className="obra-alerta-erro mt-4">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-6 text-center text-obra-suave">Carregando…</p>
      ) : (
        <>
          <p className="mb-3 mt-4 text-sm font-bold text-obra-suave">
            {lista.length} de {list.length} vistorias
          </p>
          {lista.length === 0 ? (
            <Vazio
              modulo="vistorias"
              titulo={list.length ? "Nenhuma vistoria com esses filtros" : "Nenhuma vistoria de entrega"}
              texto={list.length ? "Limpe a busca ou escolha outro filtro." : "Toque no + para registrar a primeira."}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {lista.map((d) => {
                const pend = pendingCount(d);
                return (
                  <CardItem
                    key={d.id}
                    modulo="vistorias"
                    id={d.id}
                    foto={d.photos[0]}
                    numero={[d.unit.tower, d.unit.date].filter(Boolean).join(" · ") || undefined}
                    titulo={`${d.unit.development || "Empreendimento"} · Apto ${d.unit.apartment || "—"}`}
                    detalhe={d.unit.buyer || d.result || "Em vistoria"}
                    etiqueta={pend ? <Etiqueta tom="nc">{pend} pendências</Etiqueta> : <Etiqueta tom="ok">{d.result ? "Concluída" : "Sem pendências"}</Etiqueta>}
                    progresso={progressoVistoria(d)}
                  />
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
