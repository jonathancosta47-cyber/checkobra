import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building, ListChecks } from "lucide-react";
import { listarInspecoes } from "@/lib/fvs-store";
import { numeroFvs, PAPEL_ROTULO, type InspecaoResumo } from "@/lib/fvs-db";
import { filtrarFvs, modelosDasFvs, obrasDasFvs, progressoFvs, type FiltroPendencia, type FiltroStatusFvs } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, SeletorFiltro, Vazio } from "@/components/modulos";
import { PerfilGate, usePerfil } from "@/components/PerfilGate";

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
      <PerfilGate>
        <ListaFvs />
      </PerfilGate>
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

function ListaFvs() {
  const perfil = usePerfil();
  const [list, setList] = useState<InspecaoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [nc, setNc] = useState<FiltroPendencia>("todas");
  const [status, setStatus] = useState<FiltroStatusFvs>("todas");
  const [obra, setObra] = useState("");
  const [modelo, setModelo] = useState("");

  useEffect(() => {
    listarInspecoes()
      .then(setList)
      .catch(() => setErro("Não foi possível carregar as FVS."))
      .finally(() => setCarregando(false));
  }, []);
  const lista = filtrarFvs(list, { q, nc, status, obra, modelo });

  return (
    <>
      <BuscaCard label="Buscar FVS" placeholder="Nº, modelo, obra ou local" value={q} onChange={setQ} />

      <div className="mt-4 flex items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-obra-grafite">
          <Building className="h-4 w-4 shrink-0 text-obra-suave" aria-hidden />
          <span className="truncate">{perfil.empresaNome}</span>
          <span className="shrink-0 rounded-full bg-obra-bege px-2 py-0.5 text-xs">{PAPEL_ROTULO[perfil.papel]}</span>
        </p>
        <Link to="/fvs/modelos" className="btn-ghost shrink-0">
          <ListChecks className="h-4 w-4" aria-hidden /> Modelos
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <Pilulas label="Filtrar por não conformidade" opcoes={FILTRO_NC} valor={nc} onChange={setNc} />
        <Pilulas label="Filtrar por status" opcoes={FILTRO_STATUS} valor={status} onChange={setStatus} />
        <div className="flex gap-2">
          <SeletorFiltro label="Filtrar por obra" todos="Todas as obras" valor={obra} onChange={setObra} opcoes={obrasDasFvs(list)} />
          <SeletorFiltro label="Filtrar por modelo" todos="Todos os modelos" valor={modelo} onChange={setModelo} opcoes={modelosDasFvs(list)} />
        </div>
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
                  detalhe={[i.obra, i.local].filter(Boolean).join(" · ") || "—"}
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
