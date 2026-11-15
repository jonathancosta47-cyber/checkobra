import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Phone, Plus, Power, Upload, X } from "lucide-react";
import { loadContractors, type Contractor } from "@/lib/fvs";
import {
  definirEmpreiteiroAtivo,
  importarEmpreiteirosDoAparelho,
  listarEmpreiteiros,
  salvarEmpreiteiro,
  type DadosEmpreiteiro,
} from "@/lib/configuracoes-store";
import { formatarCnpj, servicosUnicos, validarEmpreiteiro, type Empreiteiro } from "@/lib/configuracoes";
import { BuscaCard, Etiqueta, Pagina, Pilulas } from "@/components/modulos";
import { SoGerencia } from "@/components/AcessoConfig";
import { useServicosSugeridos } from "@/components/EditorModelo";

export const Route = createFileRoute("/configuracoes/empreiteiros")({
  head: () => ({ meta: [{ title: "Empreiteiros — CheckObra" }] }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <SoGerencia>
        <Empreiteiros />
      </SoGerencia>
    </Pagina>
  );
}

const vazio = (): DadosEmpreiteiro => ({ nome: "", cnpj: "", contato_nome: "", telefone: "", email: "", servicos: [], ativo: true });
const CHAVE_IMPORTADOS = "checkobra:empreiteiros-importados";
const jaImportou = () => {
  try {
    return localStorage.getItem(CHAVE_IMPORTADOS) === "1";
  } catch {
    return false;
  }
};

type Filtro = "ativos" | "todos";

function Empreiteiros() {
  const [lista, setLista] = useState<Empreiteiro[] | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [editando, setEditando] = useState<{ id: string | null; dados: DadosEmpreiteiro } | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [antigos, setAntigos] = useState<Contractor[]>([]);
  const sugeridos = useServicosSugeridos();

  const carregar = useCallback(() => {
    listarEmpreiteiros()
      .then(setLista)
      .catch(() => setErro("Não foi possível carregar os empreiteiros."));
  }, []);
  useEffect(() => {
    carregar();
    if (!jaImportou()) setAntigos(loadContractors().filter((c) => c.name.trim()));
  }, [carregar]);

  const termo = q.trim().toLowerCase();
  const visiveis = (lista ?? []).filter(
    (e) =>
      (filtro === "todos" || e.ativo) &&
      (!termo || [e.nome, e.cnpj ?? "", e.contato_nome, ...e.servicos].join(" ").toLowerCase().includes(termo)),
  );
  const todosServicos = servicosUnicos([sugeridos, ...(lista ?? []).map((e) => e.servicos)]);

  return (
    <>
      <BuscaCard label="Buscar empreiteiros" placeholder="Nome, CNPJ, contato ou serviço" value={q} onChange={setQ} />
      <div className="mt-4 space-y-4">
        {!editando && (
          <button type="button" className="obra-btn w-full" onClick={() => { setEditando({ id: null, dados: vazio() }); setAviso(""); }}>
            <Plus className="h-5 w-5" aria-hidden /> Novo empreiteiro
          </button>
        )}

        {antigos.length > 0 && (
          <section className="obra-card space-y-3 border-l-4 border-obra-laranja p-4">
            <p className="text-sm text-obra-grafite">
              Há <strong>{antigos.length}</strong> {antigos.length === 1 ? "empreiteiro" : "empreiteiros"} da tela antiga salvos só neste aparelho.
            </p>
            <button
              type="button"
              className="obra-btn-claro w-full"
              onClick={async () => {
                try {
                  const n = await importarEmpreiteirosDoAparelho(antigos);
                  try { localStorage.setItem(CHAVE_IMPORTADOS, "1"); } catch { /* sem armazenamento */ }
                  setAntigos([]);
                  setAviso(`${n} ${n === 1 ? "empreiteiro importado" : "empreiteiros importados"} (nome e serviços).`);
                  carregar();
                } catch {
                  setErro("Não foi possível importar.");
                }
              }}
            >
              <Upload className="h-5 w-5" aria-hidden /> Importar deste aparelho
            </button>
          </section>
        )}

        {editando && (
          <Formulario
            inicial={editando.dados}
            novo={!editando.id}
            servicosSugeridos={todosServicos}
            onCancelar={() => setEditando(null)}
            onSalvar={async (dados) => {
              const salvo = await salvarEmpreiteiro(editando.id, dados);
              setLista((l) => {
                const outros = (l ?? []).filter((x) => x.id !== salvo.id);
                return [...outros, salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
              });
              setEditando(null);
              setAviso(`${salvo.nome} salvo.`);
            }}
          />
        )}

        {aviso && <p role="status" className="obra-aviso">{aviso}</p>}
        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

        <Pilulas label="Mostrar" opcoes={[{ v: "ativos" as Filtro, l: "Ativos" }, { v: "todos" as Filtro, l: "Todos" }]} valor={filtro} onChange={setFiltro} />

        {lista === null ? (
          <p role="status" className="text-center text-obra-suave">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="obra-card p-5 text-center text-sm text-obra-suave">
            {lista.length ? "Nenhum empreiteiro com esses filtros." : "Nenhum empreiteiro cadastrado ainda."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visiveis.map((e) => (
              <li key={e.id} className={`obra-card space-y-3 p-4 ${e.ativo ? "" : "opacity-75"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-obra-grafite">{e.nome}</p>
                    <p className="text-sm text-obra-suave">{e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : "Sem CNPJ"}</p>
                  </div>
                  <Etiqueta tom={e.ativo ? "ok" : "aberta"}>{e.ativo ? "Ativo" : "Inativo"}</Etiqueta>
                </div>
                {(e.contato_nome || e.telefone || e.email) && (
                  <p className="flex items-center gap-2 text-sm text-obra-grafite">
                    <Phone className="h-4 w-4 shrink-0 text-obra-suave" aria-hidden />
                    <span className="truncate">{[e.contato_nome, e.telefone, e.email].filter(Boolean).join(" · ")}</span>
                  </p>
                )}
                {e.servicos.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Serviços">
                    {e.servicos.map((s) => (
                      <li key={s} className="rounded-full bg-obra-bege px-3 py-1 text-xs font-bold text-obra-grafite">{s}</li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="obra-btn-claro text-sm"
                    onClick={() => {
                      setEditando({ id: e.id, dados: { ...e, cnpj: formatarCnpj(e.cnpj) } });
                      setAviso("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden /> Editar
                  </button>
                  <button
                    type="button"
                    className="obra-btn-claro text-sm"
                    onClick={async () => {
                      const ok = await definirEmpreiteiroAtivo(e.id, !e.ativo).catch(() => false);
                      if (ok) setLista((l) => (l ?? []).map((x) => (x.id === e.id ? { ...x, ativo: !e.ativo } : x)));
                      else setErro("Não foi possível alterar.");
                    }}
                  >
                    <Power className="h-4 w-4" aria-hidden /> {e.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Formulario({
  inicial,
  novo,
  servicosSugeridos,
  onCancelar,
  onSalvar,
}: {
  inicial: DadosEmpreiteiro;
  novo: boolean;
  servicosSugeridos: string[];
  onCancelar: () => void;
  onSalvar: (d: DadosEmpreiteiro) => Promise<void>;
}) {
  const [d, setD] = useState(inicial);
  const [servico, setServico] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<DadosEmpreiteiro>) => setD((x) => ({ ...x, ...p }));
  const addServico = (s: string) => {
    const t = s.trim();
    if (t && !d.servicos.some((x) => x.toLowerCase() === t.toLowerCase())) set({ servicos: [...d.servicos, t] });
    setServico("");
  };

  return (
    <form
      className="obra-card space-y-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const invalido = validarEmpreiteiro(d);
        if (invalido) return setErro(invalido);
        setBusy(true);
        setErro("");
        try {
          await onSalvar({ ...d, servicos: servico.trim() ? [...d.servicos, servico.trim()] : d.servicos });
        } catch (err) {
          setErro((err as Error).message.includes("CNPJ") ? (err as Error).message : "Não foi possível salvar. Tente de novo.");
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-extrabold text-obra-grafite">{novo ? "Novo empreiteiro" : "Editar empreiteiro"}</h2>
      <label className="block">
        <span className="obra-label">Nome *</span>
        <input className="obra-input" value={d.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Razão social ou nome fantasia" />
      </label>
      <label className="block">
        <span className="obra-label">CNPJ</span>
        <input className="obra-input" inputMode="numeric" value={d.cnpj} onChange={(e) => set({ cnpj: formatarCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="obra-label">Contato</span>
          <input className="obra-input" value={d.contato_nome} onChange={(e) => set({ contato_nome: e.target.value })} placeholder="Nome do responsável" autoComplete="name" />
        </label>
        <label className="block">
          <span className="obra-label">Telefone</span>
          <input className="obra-input" type="tel" value={d.telefone} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) 90000-0000" autoComplete="tel" />
        </label>
      </div>
      <label className="block">
        <span className="obra-label">E-mail</span>
        <input className="obra-input" type="email" inputMode="email" value={d.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
      </label>
      <div>
        <span className="obra-label">Serviços que executa</span>
        {d.servicos.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {d.servicos.map((s) => (
              <li key={s}>
                <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-obra-bege px-3 text-sm font-bold text-obra-grafite" onClick={() => set({ servicos: d.servicos.filter((x) => x !== s) })} aria-label={`Remover serviço ${s}`}>
                  {s} <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="obra-input"
            value={servico}
            list="servicos-empreiteiro"
            placeholder="Ex.: Alvenaria"
            onChange={(e) => setServico(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addServico(servico);
              }
            }}
            aria-label="Adicionar serviço"
          />
          <button type="button" className="obra-btn-claro w-14 shrink-0 px-0" onClick={() => addServico(servico)} aria-label="Adicionar serviço">
            <Plus className="h-5 w-5" aria-hidden />
          </button>
          <datalist id="servicos-empreiteiro">
            {servicosSugeridos.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-obra-fundo px-4">
        <input type="checkbox" className="h-5 w-5 accent-[var(--obra-laranja-forte)]" checked={d.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
        <span className="text-sm font-bold text-obra-grafite">Ativo (aparece para escolher na FVS)</span>
      </label>
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="obra-btn-claro" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="obra-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}
