import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat, ListChecks } from "lucide-react";
import { loadInspections, type FvsInspection } from "@/lib/fvs";
import { filtrarFvs, modelosDasFvs, ncDaFvs, obrasDasFvs, progressoFvs, type FiltroPendencia } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, SeletorFiltro, Vazio } from "@/components/modulos";

export const Route = createFileRoute("/fvs/")({
  head: () => ({
    meta: [
      { title: "FVS — Ficha de Verificação de Serviço — CheckObra" },
      { name: "description", content: "Fichas de verificação de serviço da obra." },
    ],
  }),
  component: ListaFvs,
});

const FILTROS: { v: FiltroPendencia; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "com", l: "Com NC" },
  { v: "sem", l: "Sem NC" },
];

function ListaFvs() {
  const [list, setList] = useState<FvsInspection[]>([]);
  const [q, setQ] = useState("");
  const [nc, setNc] = useState<FiltroPendencia>("todas");
  const [obra, setObra] = useState("");
  const [modelo, setModelo] = useState("");
  useEffect(() => setList(loadInspections()), []);
  const lista = filtrarFvs(list, { q, nc, obra, modelo });

  return (
    <Pagina>
      <BuscaCard label="Buscar FVS" placeholder="Nº, modelo, obra, local ou responsável" value={q} onChange={setQ} />

      {/* Ajustes do módulo FVS */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/fvs/modelos" className="btn-ghost">
          <ListChecks className="h-4 w-4" aria-hidden /> Modelos
        </Link>
        <Link to="/fvs/empreiteiros" className="btn-ghost">
          <HardHat className="h-4 w-4" aria-hidden /> Empreiteiros
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <Pilulas label="Filtrar por não conformidade" opcoes={FILTROS} valor={nc} onChange={setNc} />
        <div className="flex gap-2">
          <SeletorFiltro label="Filtrar por obra" todos="Todas as obras" valor={obra} onChange={setObra} opcoes={obrasDasFvs(list)} />
          <SeletorFiltro label="Filtrar por modelo" todos="Todos os modelos" valor={modelo} onChange={setModelo} opcoes={modelosDasFvs(list)} />
        </div>
      </div>

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
          {lista.map((i) => {
            const n = ncDaFvs(i);
            return (
              <CardItem
                key={i.id}
                modulo="fvs"
                id={i.id}
                foto={i.photos[0]}
                numero={`FVS #${String(i.number).padStart(4, "0")} · ${new Date(i.createdAt).toLocaleDateString("pt-BR")}`}
                titulo={i.templateName || "Sem modelo"}
                detalhe={[i.obra, i.local].filter(Boolean).join(" · ") || "—"}
                etiqueta={n ? <Etiqueta tom="nc">{n} NC</Etiqueta> : <Etiqueta tom="ok">Conforme</Etiqueta>}
                progresso={progressoFvs(i)}
              />
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}
