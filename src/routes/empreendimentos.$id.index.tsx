import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Camera, ChevronRight, FileBarChart, Network, Pencil, Trash2 } from "lucide-react";
import { apagarEmpreendimento, atualizarEmpreendimento, enviarFoto, listarLocais, progressoDosEmpreendimentos, urlsDasFotos } from "@/lib/empreendimentos-store";
import { contarPorTipo, type Empreendimento, type Local } from "@/lib/empreendimentos";
import { listarOS } from "@/lib/os-store";
import { listDeliveries } from "@/lib/delivery-store";
import { listarInspecoes } from "@/lib/fvs-store";
import { gerencia } from "@/lib/fvs-db";
import { contarPendencias, MODULOS, registros, type Modulo } from "@/lib/modules";
import { Etiqueta, ICONE_MODULO, Pagina, Pilulas, Progresso } from "@/components/modulos";
import { usePerfil } from "@/components/PerfilContext";
import { useEmpreendimentos } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/empreendimentos/$id/")({
  head: () => ({ meta: [{ title: "Empreendimento — CheckObra" }] }),
  component: Painel,
});

const STATUS: Record<Empreendimento["status"], { rotulo: string; tom: "ok" | "andamento" | "aberta" }> = {
  ativa: { rotulo: "Em obra", tom: "andamento" },
  pausada: { rotulo: "Pausado", tom: "aberta" },
  concluida: { rotulo: "Concluído", tom: "ok" },
};

const TEXTO_PENDENCIA: Record<Modulo, (n: number) => string> = {
  os: (n) => (n === 1 ? "1 OS em aberto" : `${n} OS em aberto`),
  vistorias: (n) => (n === 1 ? "1 unidade com pendências" : `${n} unidades com pendências`),
  fvs: (n) => (n === 1 ? "1 ficha com NC" : `${n} fichas com NC`),
};

function Painel() {
  const { id } = Route.useParams();
  const perfil = usePerfil();
  const navigate = useNavigate();
  const { lista, atual, escolher, recarregar } = useEmpreendimentos();
  const emp = lista?.find((e) => e.id === id) ?? null;
  const [locais, setLocais] = useState<Local[]>([]);
  const [foto, setFoto] = useState("");
  const [pend, setPend] = useState<Record<Modulo, number> | null>(null);
  const [prog, setProg] = useState<{ pct: number; aprovadas: number; total: number } | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  // abrir o painel torna este o empreendimento atual
  useEffect(() => {
    if (emp && atual?.id !== emp.id) escolher(emp.id);
  }, [emp, atual?.id, escolher]);

  useEffect(() => {
    if (!emp) return;
    listarLocais([emp.id]).then(setLocais).catch(() => setLocais([]));
    progressoDosEmpreendimentos([emp.id]).then((p) => setProg(p[emp.id] ?? null)).catch(() => undefined);
    Promise.all([listarOS(emp.id), listDeliveries(emp.id), listarInspecoes(emp.id)])
      .then(([os, vs, fvs]) => setPend(contarPendencias(registros(os, vs, fvs))))
      .catch(() => setErro("Não foi possível carregar todos os módulos."));
  }, [emp]);
  useEffect(() => {
    if (emp?.foto_path) urlsDasFotos([emp.foto_path]).then((u) => setFoto(u[emp.foto_path!] ?? ""));
    else setFoto("");
  }, [emp?.foto_path]);

  if (lista === null) return <Pagina className="pt-5"><p role="status" className="text-center text-obra-suave">Carregando…</p></Pagina>;
  if (!emp)
    return (
      <Pagina className="pt-5">
        <p className="obra-card p-5 text-center text-obra-suave">Empreendimento não encontrado ou sem acesso.</p>
      </Pagina>
    );

  const n = contarPorTipo(locais);
  const podeGerenciar = gerencia(perfil.papel);

  return (
    <Pagina>
      <div className="relative z-10 -mt-7 space-y-4">
        <section className="obra-card overflow-hidden">
          {foto ? (
            <img src={foto} alt={`Foto de ${emp.nome}`} className="h-44 w-full object-cover" />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-[repeating-linear-gradient(135deg,var(--obra-bege)_0_14px,var(--obra-fundo)_14px_28px)]" aria-hidden>
              <Building2 className="h-10 w-10 text-obra-laranja-texto" />
            </div>
          )}
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-obra-grafite">{emp.nome}</h2>
                <p className="text-sm text-obra-suave">{emp.endereco || "Sem endereço"}</p>
              </div>
              <Etiqueta tom={STATUS[emp.status].tom}>{STATUS[emp.status].rotulo}</Etiqueta>
            </div>
            <Progresso valor={prog?.pct ?? 0} />
            <p className="text-xs text-obra-suave">{prog ? `${prog.aprovadas} de ${prog.total} unidades entregues` : "Calculando progresso…"}</p>
            <p className="text-sm text-obra-grafite">
              {n.torre} {n.torre === 1 ? "torre" : "torres"} · {n.pavimento} pavimentos · {n.unidade} unidades · {n.area_comum} áreas comuns
            </p>
            {podeGerenciar && !editando && (
              <button type="button" className="obra-btn-claro w-full" onClick={() => setEditando(true)}>
                <Pencil className="h-5 w-5" aria-hidden /> Editar dados
              </button>
            )}
            {podeGerenciar && editando && (
              <EditarDados
                emp={emp}
                onCancelar={() => setEditando(false)}
                onSalvar={async (campos) => {
                  if (!(await atualizarEmpreendimento(emp.id, campos))) throw new Error("sem permissão");
                  await recarregar();
                  setEditando(false);
                }}
              />
            )}
            {podeGerenciar && (
              <label className="obra-btn-claro w-full cursor-pointer">
                <Camera className="h-5 w-5" aria-hidden /> {enviando ? "Enviando…" : emp.foto_path ? "Trocar foto" : "Adicionar foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={enviando}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setEnviando(true);
                    setErro("");
                    try {
                      await enviarFoto(perfil.empresaId, emp.id, f);
                      await recarregar();
                    } catch {
                      setErro("Não foi possível enviar a foto.");
                    } finally {
                      setEnviando(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

        <section aria-label="Módulos">
          <ul className="grid gap-3 sm:grid-cols-3">
            {(["os", "vistorias", "fvs"] as const).map((m) => {
              const Icone = ICONE_MODULO[m];
              const qtd = pend?.[m];
              return (
                <li key={m}>
                  <Link to={MODULOS[m].lista as "/os" | "/vistorias" | "/fvs"} className="obra-card flex min-h-20 items-center gap-3 p-4 transition active:scale-[0.99]">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-obra-laranja text-obra-grafite">
                      <Icone className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-obra-grafite">{MODULOS[m].nome}</span>
                      <span className={`block text-sm font-bold ${qtd ? "text-obra-nc" : "text-obra-suave"}`}>
                        {qtd === undefined ? "Carregando…" : qtd ? TEXTO_PENDENCIA[m](qtd) : "Nada pendente"}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/empreendimentos/$id/estrutura" params={{ id: emp.id }} className="obra-btn-claro">
            <Network className="h-5 w-5" aria-hidden /> Estrutura
          </Link>
          <Link to="/relatorios" className="obra-btn-claro">
            <FileBarChart className="h-5 w-5" aria-hidden /> Relatórios
          </Link>
        </div>

        {perfil.papel === "admin_empresa" && (
          <section className="obra-card space-y-3 p-4">
            {!apagar ? (
              <button type="button" className="obra-link -ml-3 text-obra-nc decoration-obra-nc" onClick={() => setApagar(true)}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Apagar empreendimento
              </button>
            ) : (
              <>
                <p className="obra-alerta-erro">
                  Isto apaga o empreendimento e <strong>tudo dele</strong>: estrutura, OS, vistorias e FVS. Não dá para desfazer.
                </p>
                <label className="block">
                  <span className="obra-label">Digite o nome do empreendimento para confirmar</span>
                  <input className="obra-input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={emp.nome} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="obra-btn-claro" onClick={() => { setApagar(false); setConfirmacao(""); }}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="obra-btn bg-obra-nc text-white hover:bg-obra-nc"
                    disabled={confirmacao.trim() !== emp.nome.trim()}
                    onClick={async () => {
                      const ok = await apagarEmpreendimento(emp.id).catch(() => false);
                      if (!ok) return setErro("Não foi possível apagar.");
                      escolher(null);
                      await recarregar();
                      navigate({ to: "/", replace: true });
                    }}
                  >
                    Apagar
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </Pagina>
  );
}

// Editar nome, endereço e status do empreendimento (admin e engenheiro; o banco também confere).
function EditarDados({
  emp,
  onCancelar,
  onSalvar,
}: {
  emp: Empreendimento;
  onCancelar: () => void;
  onSalvar: (campos: Pick<Empreendimento, "nome" | "endereco" | "status">) => Promise<void>;
}) {
  const [nome, setNome] = useState(emp.nome);
  const [endereco, setEndereco] = useState(emp.endereco);
  const [status, setStatus] = useState<Empreendimento["status"]>(emp.status);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4 rounded-2xl bg-obra-fundo p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nome.trim()) return setErro("Informe o nome do empreendimento.");
        setBusy(true);
        setErro("");
        try {
          await onSalvar({ nome: nome.trim(), endereco: endereco.trim(), status });
        } catch {
          setErro("Não foi possível salvar. Verifique a internet e tente de novo.");
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className="obra-label">Nome *</span>
        <input className="obra-input" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="block">
        <span className="obra-label">Endereço</span>
        <input className="obra-input" value={endereco} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" />
      </label>
      <div>
        <span className="obra-label">Status</span>
        <Pilulas
          label="Status do empreendimento"
          opcoes={[
            { v: "ativa" as const, l: "Em obra" },
            { v: "pausada" as const, l: "Pausado" },
            { v: "concluida" as const, l: "Concluído" },
          ]}
          valor={status}
          onChange={setStatus}
        />
      </div>
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="obra-btn-claro" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="obra-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}
