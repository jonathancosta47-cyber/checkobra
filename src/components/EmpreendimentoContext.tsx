import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { listarEmpreendimentos } from "@/lib/empreendimentos-store";
import type { Empreendimento } from "@/lib/empreendimentos";
import { gerencia } from "@/lib/fvs-db";
import { usePerfil } from "@/components/PerfilContext";

interface Ctx {
  lista: Empreendimento[] | null; // null = carregando
  erro: boolean;
  atual: Empreendimento | null;
  escolher: (id: string | null) => void;
  recarregar: () => Promise<void>;
}
const EmpCtx = createContext<Ctx | null>(null);

export function useEmpreendimentos(): Ctx {
  const c = useContext(EmpCtx);
  if (!c) throw new Error("useEmpreendimentos fora do EmpreendimentoProvider");
  return c;
}

const chave = (perfilId: string) => `checkobra:empreendimento:${perfilId}`;
const lerEscolha = (perfilId: string) => {
  try {
    return localStorage.getItem(chave(perfilId));
  } catch {
    return null;
  }
};
const gravarEscolha = (perfilId: string, id: string | null) => {
  try {
    if (id) localStorage.setItem(chave(perfilId), id);
    else localStorage.removeItem(chave(perfilId));
  } catch {
    /* sem armazenamento: a escolha vale só nesta visita */
  }
};

// Empreendimentos visíveis para a pessoa e o "empreendimento atual" (lembrado neste aparelho).
export function EmpreendimentoProvider({ children }: { children: ReactNode }) {
  const perfil = usePerfil();
  const [lista, setLista] = useState<Empreendimento[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atualId, setAtualId] = useState<string | null>(() => lerEscolha(perfil.id));

  const recarregar = useCallback(async () => {
    try {
      const l = await listarEmpreendimentos();
      setLista(l);
      setErro(false);
      // só um empreendimento: já fica escolhido
      setAtualId((id) => (id && l.some((e) => e.id === id) ? id : l.length === 1 ? l[0]!.id : null));
    } catch {
      setErro(true);
      setLista((l) => l ?? []);
    }
  }, []);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const escolher = useCallback(
    (id: string | null) => {
      setAtualId(id);
      gravarEscolha(perfil.id, id);
    },
    [perfil.id],
  );
  const atual = useMemo(() => lista?.find((e) => e.id === atualId) ?? null, [lista, atualId]);

  return <EmpCtx.Provider value={{ lista, erro, atual, escolher, recarregar }}>{children}</EmpCtx.Provider>;
}

// Telas de módulo: só aparecem com um empreendimento escolhido; senão, pede para escolher.
export function ComEmpreendimento({ children }: { children: (e: Empreendimento) => ReactNode }) {
  const { atual } = useEmpreendimentos();
  if (atual) return <>{children(atual)}</>;
  return <EscolherEmpreendimento />;
}

export function EscolherEmpreendimento({ titulo = "Escolha o empreendimento", onEscolhido }: { titulo?: string; onEscolhido?: () => void }) {
  const perfil = usePerfil();
  const { lista, erro, escolher, recarregar } = useEmpreendimentos();
  if (lista === null) return <p role="status" className="py-10 text-center text-obra-suave">Carregando…</p>;
  return (
    <section className="obra-card space-y-3 p-4" aria-label={titulo}>
      <h2 className="text-lg font-extrabold text-obra-grafite">{titulo}</h2>
      {erro && (
        <div className="space-y-2">
          <p role="alert" className="obra-alerta-erro">Não foi possível carregar os empreendimentos.</p>
          <button type="button" className="obra-btn-claro w-full" onClick={() => void recarregar()}>Tentar de novo</button>
        </div>
      )}
      {lista.length === 0 && !erro ? (
        <p className="text-sm text-obra-suave">
          {gerencia(perfil.papel)
            ? "Sua empresa ainda não tem empreendimentos. Crie o primeiro para começar."
            : "Nenhum empreendimento liberado para você ainda. Peça ao admin da empresa."}
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  escolher(e.id);
                  onEscolhido?.();
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-obra-borda bg-obra-card px-3 text-left transition hover:bg-obra-fundo"
              >
                <Building2 className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-obra-grafite">{e.nome}</span>
                  {e.endereco && <span className="block truncate text-xs text-obra-suave">{e.endereco}</span>}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {gerencia(perfil.papel) && (
        <Link to="/empreendimentos/novo" className="obra-btn w-full">
          <Plus className="h-5 w-5" aria-hidden /> Novo empreendimento
        </Link>
      )}
    </section>
  );
}
