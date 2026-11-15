import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Power } from "lucide-react";
import { definirModeloAtivo, duplicarModelo, listarModelosAtuais } from "@/lib/configuracoes-store";
import { ehPadrao, ordenarModelos, type ModeloResumo } from "@/lib/configuracoes";
import { Etiqueta, Pagina, Pilulas } from "@/components/modulos";
import { SoGerencia } from "@/components/AcessoConfig";

export const Route = createFileRoute("/configuracoes/modelos/")({
  head: () => ({ meta: [{ title: "Modelos de FVS — CheckObra" }] }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <div className="relative z-10 -mt-7">
        <SoGerencia>
          <ListaModelos />
        </SoGerencia>
      </div>
    </Pagina>
  );
}

type Aba = "empresa" | "padrao";

function ListaModelos() {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState<ModeloResumo[] | null>(null);
  const [aba, setAba] = useState<Aba>("empresa");
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(() => {
    listarModelosAtuais()
      .then(setModelos)
      .catch(() => setErro("Não foi possível carregar os modelos."));
  }, []);
  useEffect(carregar, [carregar]);

  if (!modelos) return <p role="status" className="obra-card p-5 text-center text-obra-suave">{erro || "Carregando…"}</p>;
  const lista = ordenarModelos(modelos.filter((m) => (aba === "padrao") === ehPadrao(m)));

  const acao = async (id: string, fn: () => Promise<unknown>, falha: string) => {
    setOcupado(id);
    setErro("");
    try {
      await fn();
    } catch {
      setErro(falha);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/configuracoes/modelos/novo" className="obra-btn w-full shadow-obra">
        <Plus className="h-5 w-5" aria-hidden /> Novo modelo
      </Link>
      <Pilulas
        label="Tipo de modelo"
        opcoes={[
          { v: "empresa" as Aba, l: `Da empresa (${modelos.filter((m) => !ehPadrao(m)).length})` },
          { v: "padrao" as Aba, l: `Padrão do sistema (${modelos.filter(ehPadrao).length})` },
        ]}
        valor={aba}
        onChange={setAba}
      />
      {aba === "padrao" && <p className="obra-aviso">Modelos padrão são só para leitura. Para adaptar, use “Duplicar para minha empresa”.</p>}
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {lista.length === 0 ? (
        <p className="obra-card p-5 text-center text-sm text-obra-suave">
          {aba === "empresa" ? "Sua empresa ainda não tem modelos. Crie um ou duplique um modelo padrão." : "Nenhum modelo padrão disponível."}
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((m) => (
            <li key={m.id} className={`obra-card overflow-hidden ${m.ativo ? "" : "opacity-75"}`}>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold text-obra-grafite">{m.nome}</p>
                    <p className="text-sm text-obra-suave">
                      {m.servico || "Sem serviço"} · {m.itens.length} {m.itens.length === 1 ? "item" : "itens"} · v{m.versao}
                    </p>
                  </div>
                  <Etiqueta tom={m.ativo ? "ok" : "aberta"}>{m.ativo ? "Ativo" : "Inativo"}</Etiqueta>
                </div>
                <button
                  type="button"
                  className="obra-link -ml-3"
                  aria-expanded={aberto === m.id}
                  onClick={() => setAberto(aberto === m.id ? null : m.id)}
                >
                  {aberto === m.id ? <ChevronUp className="mr-1 h-4 w-4" aria-hidden /> : <ChevronDown className="mr-1 h-4 w-4" aria-hidden />}
                  {aberto === m.id ? "Esconder itens" : "Ver itens"}
                </button>
                {aberto === m.id && (
                  <ol className="divide-y divide-obra-borda rounded-2xl bg-obra-fundo px-3">
                    {m.itens.map((i, k) => (
                      <li key={i.id ?? k} className="py-2 text-sm">
                        <p className="font-bold text-obra-grafite">
                          {k + 1}. {i.texto} {i.exige_foto && <span className="ml-1 rounded-full bg-obra-bege px-2 text-xs">exige foto</span>}
                        </p>
                        {i.criterio && <p className="text-obra-suave">Critério: {i.criterio}</p>}
                      </li>
                    ))}
                  </ol>
                )}
                <div className={`grid gap-2 ${ehPadrao(m) ? "grid-cols-1" : "grid-cols-3"}`}>
                  {!ehPadrao(m) && (
                    <Link to="/configuracoes/modelos/$id" params={{ id: m.id }} className="obra-btn-claro px-2 text-sm">
                      <Pencil className="h-4 w-4" aria-hidden /> Editar
                    </Link>
                  )}
                  <button
                    type="button"
                    className="obra-btn-claro px-2 text-sm"
                    disabled={ocupado === m.id}
                    onClick={() =>
                      acao(m.id, async () => {
                        const id = await duplicarModelo(m.id);
                        navigate({ to: "/configuracoes/modelos/$id", params: { id } });
                      }, "Não foi possível duplicar.")
                    }
                  >
                    <Copy className="h-4 w-4" aria-hidden /> {ehPadrao(m) ? "Duplicar para minha empresa" : "Duplicar"}
                  </button>
                  {!ehPadrao(m) && (
                    <button
                      type="button"
                      className="obra-btn-claro px-2 text-sm"
                      disabled={ocupado === m.id}
                      onClick={() =>
                        acao(m.id, async () => {
                          if (!(await definirModeloAtivo(m.id, !m.ativo))) throw new Error("sem permissão");
                          setModelos((ms) => (ms ?? []).map((x) => (x.id === m.id ? { ...x, ativo: !m.ativo } : x)));
                        }, "Não foi possível alterar.")
                      }
                    >
                      <Power className="h-4 w-4" aria-hidden /> {m.ativo ? "Desativar" : "Reativar"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
