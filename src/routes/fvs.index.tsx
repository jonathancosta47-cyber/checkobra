import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listarInspecoes } from "@/lib/fvs-store";
import { numeroFvs, type InspecaoResumo } from "@/lib/fvs-db";
import type { Empreendimento } from "@/lib/empreendimentos";
import { filtrarFvs, modelosDasFvs, progressoFvs, type FiltroPendencia, type FiltroStatusFvs } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, SeletorFiltro, Vazio } from "@/components/modulos";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/fvs/")({
  head: () => ({
    meta: [
      { title: "FVS — Ficha de Verificação de Serviço — CheckObra" },
      { name: "description", content: "Fichas de verificação de serviço da obra." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <ComEmpreendimento>{(emp) => <ListaFvs key={emp.id} emp={emp} />}</ComEmpreendimento>
    </Pagina>
  );
}

const FILTRO_NC: { v: FiltroPendencia; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "com", l: "Com NC" },
  { v: "sem", l: "Sem NC" },
];
const FILTRO_STATUS: { v: FiltroStatusFvs; l: string }[] = [
  { v: "todas", l: "Qualquer status" },
  { v: "rascunho", l: "Em andamento" },
  { v: "concluida", l: "Concluídas" },
];

function ListaFvs({ emp }: { emp: Empreendimento }) {
  const [list, setList] = useState<InspecaoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [nc, setNc] = useState<FiltroPendencia>("todas");
  const [status, setStatus] = useState<FiltroStatusFvs>("todas");
  const [modelo, setModelo] = useState("");

  useEffect(() => {
    listarInspecoes(emp.id)
      .then(setList)
      .catch(() => setErro("Não foi possível carregar as FVS."))
      .finally(() => setCarregando(false));
  }, [emp.id]);
  const lista = filtrarFvs(list, { q, nc, status, modelo });

  return (
    <>
      <BuscaCard label="Buscar FVS" placeholder="Nº, modelo, obra ou local" value={q} onChange={setQ} />


      <div className="mt-4 space-y-3">
        <Pilulas label="Filtrar por não conformidade" opcoes={FILTRO_NC} valor={nc} onChange={setNc} />
        <Pilulas label="Filtrar por status" opcoes={FILTRO_STATUS} valor={status} onChange={setStatus} />
        <SeletorFiltro label="Filtrar por modelo" todos="Todos os modelos" valor={modelo} onChange={setModelo} opcoes={modelosDasFvs(list)} />
      </div>

      {erro && <p role="alert" className="obra-alerta-erro mt-4">{erro}</p>}
      {carregando ? (
        <p role="status" className="mt-6 text-center text-obra-suave">Carregando…</p>
      ) : (
        <>
          <p className="mb-3 mt-4 text-sm font-bold text-obra-suave">
            {lista.length} de {list.length} fichas
          </p>
          {lista.length === 0 ? (
            <Vazio
              modulo="fvs"
              titulo={list.length ? "Nenhuma FVS com esses filtros" : "Nenhuma FVS ainda"}
              texto={list.length ? "Limpe a busca ou escolha outro filtro." : "Toque no + para preencher a primeira."}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {lista.map((i) => (
                <CardItem
                  key={i.id}
                  modulo="fvs"
                  id={i.id}
                  numero={`${numeroFvs(i.numero)} · ${new Date(i.criadaEm).toLocaleDateString("pt-BR")}`}
                  titulo={i.modelo || "Sem modelo"}
                  detalhe={i.local || "—"}
                  etiqueta={
                    i.nc ? (
                      <Etiqueta tom="nc">{i.nc} NC</Etiqueta>
                    ) : i.status === "rascunho" ? (
                      <Etiqueta tom="andamento">Em andamento</Etiqueta>
                    ) : (
                      <Etiqueta tom="ok">Conforme</Etiqueta>
                    )
                  }
                  progresso={progressoFvs(i)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
