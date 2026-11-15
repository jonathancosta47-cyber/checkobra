import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import type { ServiceOrder } from "@/lib/orders";
import { listarOS } from "@/lib/os-store";
import type { Empreendimento } from "@/lib/empreendimentos";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";
import { listarInspecoes } from "@/lib/fvs-store";
import type { InspecaoResumo } from "@/lib/fvs-db";
import { listDeliveries } from "@/lib/delivery-store";
import type { Delivery } from "@/lib/delivery";
import { filtrarRelatorios, MODULOS, registros, type Modulo } from "@/lib/modules";
import { Etiqueta, ICONE_MODULO, LinkRegistro, Pagina, Pilulas } from "@/components/modulos";

// Área só de consulta e exportação: cada linha abre o relatório do registro,
// onde ficam "Baixar PDF" e "Imprimir". Nada é criado ou editado aqui.
export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — CheckObra" },
      { name: "description", content: "Consulte e exporte em PDF as OS, vistorias de entrega e FVS." },
    ],
  }),
  component: Relatorios,
});

type FiltroModulo = Modulo | "todos";
const MODULOS_FILTRO: { v: FiltroModulo; l: string }[] = [
  { v: "todos", l: "Todos" },
  { v: "os", l: "OS" },
  { v: "vistorias", l: "Vistorias" },
  { v: "fvs", l: "FVS" },
];

function Relatorios() {
  return (
    <Pagina className="pt-5">
      <ComEmpreendimento>{(emp) => <ListaRelatorios key={emp.id} emp={emp} />}</ComEmpreendimento>
    </Pagina>
  );
}

function ListaRelatorios({ emp }: { emp: Empreendimento }) {
  const [os, setOs] = useState<ServiceOrder[]>([]);
  const [fvs, setFvs] = useState<InspecaoResumo[]>([]);
  const [vistorias, setVistorias] = useState<Delivery[]>([]);
  const [erroVistorias, setErroVistorias] = useState(false);
  const [erroOS, setErroOS] = useState(false);
  const [modulo, setModulo] = useState<FiltroModulo>("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  useEffect(() => {
    listarOS(emp.id)
      .then(setOs)
      .catch(() => setErroOS(true));
    listarInspecoes(emp.id)
      .then(setFvs)
      .catch(() => setFvs([]));
    listDeliveries(emp.id)
      .then(setVistorias)
      .catch(() => setErroVistorias(true));
  }, [emp.id]);

  const linhas = filtrarRelatorios(registros(os, vistorias, fvs), { modulo, de, ate });
  const temFiltro = modulo !== "todos" || de || ate;

  return (
    <>
      <section className="obra-card space-y-4 p-4" aria-label="Filtros">
        <Pilulas label="Filtrar por módulo" opcoes={MODULOS_FILTRO} valor={modulo} onChange={setModulo} />
        <p className="text-sm text-obra-suave">Empreendimento: <strong className="text-obra-grafite">{emp.nome}</strong> (troque no topo da tela)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="obra-label">De</span>
            <input className="obra-input" type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="block">
            <span className="obra-label">Até</span>
            <input className="obra-input" type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
          </label>
        </div>
        {temFiltro && (
          <button
            type="button"
            className="obra-link"
            onClick={() => {
              setModulo("todos");
              setDe("");
              setAte("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </section>

      {erroOS && (modulo === "todos" || modulo === "os") && (
        <p role="alert" className="obra-alerta-erro mt-4">
          Não foi possível carregar as OS.
        </p>
      )}
      {erroVistorias && (modulo === "todos" || modulo === "vistorias") && (
        <p role="alert" className="obra-alerta-erro mt-4">
          Não foi possível carregar as vistorias de entrega.
        </p>
      )}

      <p className="mb-3 mt-5 text-sm font-bold text-obra-suave">
        {linhas.length} {linhas.length === 1 ? "relatório" : "relatórios"}
      </p>
      {linhas.length === 0 ? (
        <p className="obra-card p-5 text-center text-sm text-obra-suave">Nenhum relatório para esses filtros.</p>
      ) : (
        <ul className="obra-card divide-y divide-obra-borda overflow-hidden">
          {linhas.map((r) => {
            const Icone = ICONE_MODULO[r.modulo];
            return (
              <li key={`${r.modulo}-${r.id}`}>
                <LinkRegistro modulo={r.modulo} id={r.id} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-obra-fundo">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-obra-bege">
                    <Icone className="h-5 w-5 text-obra-grafite" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-obra-grafite">{r.titulo}</span>
                    <span className="block truncate text-xs text-obra-suave">
                      {MODULOS[r.modulo].nomeCurto} · {new Date(r.data).toLocaleDateString("pt-BR")}
                      {r.obra ? ` · ${r.obra}` : ""}
                    </span>
                  </span>
                  <Etiqueta tom={r.pendente ? "nc" : "ok"}>{r.situacao}</Etiqueta>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-obra-laranja text-obra-grafite" title="Abrir para baixar o PDF">
                    <FileDown className="h-5 w-5" aria-label="Abrir relatório e baixar PDF" />
                  </span>
                </LinkRegistro>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
