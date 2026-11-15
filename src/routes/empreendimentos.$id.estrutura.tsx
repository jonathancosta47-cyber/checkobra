import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { adicionarLocal, listarLocais, removerLocal, renomearLocal } from "@/lib/empreendimentos-store";
import { contarPorTipo, descendentes, filhosDe, proximaOrdem, sugerirNome, tiposFilhos, TIPO_ROTULO, type Local, type TipoLocal } from "@/lib/empreendimentos";
import { gerencia } from "@/lib/fvs-db";
import { Pagina } from "@/components/modulos";
import { usePerfil } from "@/components/PerfilContext";
import { useEmpreendimentos } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/empreendimentos/$id/estrutura")({
  head: () => ({ meta: [{ title: "Estrutura do empreendimento — CheckObra" }] }),
  component: Estrutura,
});

const ARTIGO: Record<TipoLocal, string> = { torre: "a torre", pavimento: "o pavimento", unidade: "a unidade", area_comum: "a área comum" };

function Estrutura() {
  const { id } = Route.useParams();
  const perfil = usePerfil();
  const { lista } = useEmpreendimentos();
  const emp = lista?.find((e) => e.id === id);
  const [locais, setLocais] = useState<Local[] | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pode = gerencia(perfil.papel);

  useEffect(() => {
    listarLocais([id])
      .then(setLocais)
      .catch(() => setErro("Não foi possível carregar a estrutura."));
  }, [id]);

  if (!locais) return <Pagina className="pt-5"><p role="status" className="text-center text-obra-suave">{erro || "Carregando…"}</p></Pagina>;

  const alternar = (lid: string) => setAbertos((s) => { const n = new Set(s); n.has(lid) ? n.delete(lid) : n.add(lid); return n; });

  const executar = async (fn: () => Promise<void>, falha: string) => {
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch {
      setErro(falha);
    } finally {
      setOcupado(false);
    }
  };

  const adicionar = (pai: Local | null, tipo: TipoLocal) =>
    executar(async () => {
      const novo = await adicionarLocal({
        empreendimentoId: id,
        paiId: pai?.id ?? null,
        tipo,
        nome: sugerirNome(locais, pai, tipo),
        ordem: tipo === "area_comum" ? 1000 + proximaOrdem(locais, pai?.id ?? null) : proximaOrdem(locais, pai?.id ?? null),
      });
      setLocais((ls) => [...(ls ?? []), novo]);
      if (pai) setAbertos((s) => new Set(s).add(pai.id));
      setEditando({ id: novo.id, nome: novo.nome });
    }, "Não foi possível adicionar.");

  const salvarNome = () =>
    editando &&
    executar(async () => {
      const nome = editando.nome.trim();
      if (!nome) throw new Error("vazio");
      if (!(await renomearLocal(editando.id, nome))) throw new Error("sem permissão");
      setLocais((ls) => (ls ?? []).map((l) => (l.id === editando.id ? { ...l, nome } : l)));
      setEditando(null);
    }, "Não foi possível renomear (o nome não pode ficar vazio).");

  const remover = (l: Local) =>
    executar(async () => {
      if (!(await removerLocal(l.id))) throw new Error("sem permissão");
      const fora = new Set([l.id, ...descendentes(locais, l.id).map((d) => d.id)]);
      setLocais((ls) => (ls ?? []).filter((x) => !fora.has(x.id)));
      setRemovendo(null);
    }, "Não foi possível remover.");

  const total = contarPorTipo(locais);

  // função (não componente): assim o campo de renomear não perde o foco a cada letra
  const no = (l: Local, nivel: number) => {
    const filhos = filhosDe(locais, l.id);
    const aberto = abertos.has(l.id);
    const tiposNovos = tiposFilhos(l.tipo);
    const qtdDentro = descendentes(locais, l.id).length;
    return (
      <li key={l.id}>
        <div className="flex min-h-14 items-center gap-1 border-b border-obra-borda py-1" style={{ paddingLeft: `${nivel * 14}px` }}>
          {filhos.length ? (
            <button type="button" className="obra-icone-btn h-10 w-10 bg-transparent" onClick={() => alternar(l.id)} aria-expanded={aberto} aria-label={`${aberto ? "Fechar" : "Abrir"} ${l.nome}`}>
              {aberto ? <ChevronDown className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
            </button>
          ) : (
            <span className="w-10 shrink-0" aria-hidden />
          )}
          {editando?.id === l.id ? (
            <form className="flex min-w-0 flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); void salvarNome(); }}>
              <input
                className="obra-input min-h-11 py-1"
                autoFocus
                value={editando.nome}
                onChange={(e) => setEditando({ id: l.id, nome: e.target.value })}
                aria-label={`Novo nome para ${l.nome}`}
              />
              <button type="submit" className="obra-icone-btn bg-obra-laranja" aria-label="Salvar nome" disabled={ocupado}>
                <Check className="h-5 w-5" aria-hidden />
              </button>
              <button type="button" className="obra-icone-btn bg-obra-fundo" aria-label="Cancelar" onClick={() => setEditando(null)}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </form>
          ) : (
            <>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => filhos.length && alternar(l.id)}>
                <span className="block truncate font-bold text-obra-grafite">{l.nome}</span>
                <span className="block text-xs text-obra-suave">
                  {TIPO_ROTULO[l.tipo]}
                  {filhos.length ? ` · ${filhos.length} ${filhos.length === 1 ? "item" : "itens"}` : ""}
                </span>
              </button>
              {pode && (
                <div className="flex shrink-0 items-center">
                  {tiposNovos.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-xs font-extrabold text-obra-grafite hover:bg-obra-bege disabled:opacity-50"
                      disabled={ocupado}
                      onClick={() => void adicionar(l, t)}
                      aria-label={`Adicionar ${TIPO_ROTULO[t].toLowerCase()} em ${l.nome}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {t === "area_comum" ? "Área" : TIPO_ROTULO[t]}
                    </button>
                  ))}
                  <button type="button" className="obra-icone-btn h-11 w-11 bg-transparent" onClick={() => setEditando({ id: l.id, nome: l.nome })} aria-label={`Renomear ${l.nome}`}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="obra-icone-btn h-11 w-11 bg-transparent text-obra-nc" onClick={() => setRemovendo(l.id)} aria-label={`Remover ${l.nome}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {removendo === l.id && (
          <div className="obra-alerta-erro my-2 space-y-2" style={{ marginLeft: `${nivel * 14}px` }} role="alertdialog" aria-label={`Remover ${l.nome}`}>
            <p>
              Remover {ARTIGO[l.tipo]} <strong>{l.nome}</strong>
              {qtdDentro ? ` e ${qtdDentro} ${qtdDentro === 1 ? "item" : "itens"} dentro` : ""}? As FVS registradas nesses locais também são apagadas; OS e
              vistorias ficam sem local.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="obra-btn-claro" onClick={() => setRemovendo(null)}>Cancelar</button>
              <button type="button" className="obra-btn bg-obra-nc text-white hover:bg-obra-nc" disabled={ocupado} onClick={() => void remover(l)}>
                Remover
              </button>
            </div>
          </div>
        )}
        {aberto && filhos.length > 0 && (
          <ul>
            {filhos.map((f) => no(f, nivel + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <Pagina>
      <div className="relative z-10 -mt-7 space-y-4">
        <section className="obra-card p-4">
          <h2 className="text-lg font-extrabold text-obra-grafite">{emp?.nome ?? "Empreendimento"}</h2>
          <p className="text-sm text-obra-suave">
            {total.torre} {total.torre === 1 ? "torre" : "torres"} · {total.pavimento} pavimentos · {total.unidade} unidades · {total.area_comum} áreas comuns
          </p>
          {!pode && <p className="obra-aviso mt-3">Só o admin ou um engenheiro altera a estrutura.</p>}
        </section>

        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

        <section className="obra-card p-2" aria-label="Estrutura">
          {filhosDe(locais, null).length === 0 ? (
            <p className="p-4 text-center text-sm text-obra-suave">Nenhum local ainda.</p>
          ) : (
            <ul>
              {filhosDe(locais, null).map((l) => no(l, 0))}
            </ul>
          )}
        </section>

        {pode && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="obra-btn-claro" disabled={ocupado} onClick={() => void adicionar(null, "torre")}>
              <Plus className="h-5 w-5" aria-hidden /> Torre
            </button>
            <button type="button" className="obra-btn-claro" disabled={ocupado} onClick={() => void adicionar(null, "area_comum")}>
              <Plus className="h-5 w-5" aria-hidden /> Área comum
            </button>
          </div>
        )}
      </div>
    </Pagina>
  );
}
