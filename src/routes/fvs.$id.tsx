import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Lock, Minus, RotateCcw, X } from "lucide-react";
import { concluirInspecao, lerInspecao, reabrirInspecao, salvarObservacoes, salvarResposta } from "@/lib/fvs-store";
import {
  contarRespostas,
  gerencia,
  motivoParaNaoConcluir,
  numeroFvs,
  podeEditar,
  progresso,
  RESULTADO_ROTULO,
  type Inspecao,
  type Resposta,
  type Resultado,
} from "@/lib/fvs-db";
import { Etiqueta, Pagina, Progresso } from "@/components/modulos";
import { PerfilGate, usePerfil } from "@/components/PerfilGate";

export const Route = createFileRoute("/fvs/$id")({
  head: () => ({
    meta: [
      { title: "FVS — CheckObra" },
      { name: "description", content: "Preencha a ficha de verificação de serviço." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return (
    <Pagina className="pt-5">
      <PerfilGate>
        <Ficha id={id} />
      </PerfilGate>
    </Pagina>
  );
}

const BOTOES: { r: Resultado; curto: string; icone: typeof Check; ativo: string }[] = [
  { r: "C", curto: "C", icone: Check, ativo: "border-obra-ok bg-obra-ok-fundo text-obra-ok" },
  { r: "NC", curto: "NC", icone: X, ativo: "border-obra-nc bg-obra-nc-fundo text-obra-nc" },
  { r: "NA", curto: "N/A", icone: Minus, ativo: "border-obra-suave bg-obra-fundo text-obra-grafite" },
];

function Ficha({ id }: { id: string }) {
  const perfil = usePerfil();
  const [f, setF] = useState<Inspecao | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(0);
  const [concluindo, setConcluindo] = useState(false);

  useEffect(() => {
    lerInspecao(id)
      .then(setF)
      .catch(() => setErro("Não foi possível carregar a FVS."));
  }, [id]);

  if (f === undefined) return <p role="status" className="py-10 text-center text-obra-suave">{erro || "Carregando…"}</p>;
  if (f === null) return <p className="obra-card p-5 text-center text-obra-suave">FVS não encontrada ou sem acesso.</p>;

  const editavel = podeEditar(perfil, f);
  const contagem = contarRespostas(f.respostas);
  const motivo = motivoParaNaoConcluir(f.respostas);

  // Atualiza na tela na hora e salva no banco; se o banco recusar, desfaz.
  const atualizar = async (r: Resposta, campos: Partial<Pick<Resposta, "resultado" | "observacao">>) => {
    const antes = f.respostas;
    setF({ ...f, respostas: f.respostas.map((x) => (x.id === r.id ? { ...x, ...campos } : x)) });
    setSalvando((n) => n + 1);
    setErro("");
    try {
      if (!(await salvarResposta(r.id, campos))) throw new Error("sem permissão");
    } catch {
      setF((cur) => (cur ? { ...cur, respostas: antes } : cur));
      setErro("Não foi possível salvar. Verifique a internet e tente de novo.");
    } finally {
      setSalvando((n) => n - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* cabeçalho da ficha */}
      <section className="obra-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-obra-laranja-texto">{numeroFvs(f.numero)}</p>
            <h2 className="text-xl font-extrabold leading-tight text-obra-grafite">{f.modelo}</h2>
            <p className="text-sm text-obra-suave">{f.obra}</p>
            <p className="text-sm font-semibold text-obra-grafite">{f.local}</p>
          </div>
          {f.status === "concluida" ? (
            <Etiqueta tom={contagem.nc ? "nc" : "ok"}>{contagem.nc ? `Concluída · ${contagem.nc} NC` : "Concluída"}</Etiqueta>
          ) : (
            <Etiqueta tom="andamento">Em andamento</Etiqueta>
          )}
        </div>
        <Progresso valor={progresso(contagem)} />
        <p className="text-xs text-obra-suave" aria-live="polite">
          {contagem.respondidos} de {contagem.total} itens respondidos{contagem.nc ? ` · ${contagem.nc} não conforme${contagem.nc > 1 ? "s" : ""}` : ""}
          {salvando > 0 ? " · salvando…" : ""}
        </p>
        {!editavel && (
          <p className="obra-aviso flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            {f.status === "concluida" ? "FVS concluída: só leitura." : "Só quem abriu esta FVS, um engenheiro ou o admin podem editá-la."}
          </p>
        )}
      </section>

      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {/* itens */}
      <ol className="space-y-3">
        {f.respostas.map((r, k) => (
          <Item key={r.id} n={k + 1} r={r} editavel={editavel} onChange={(campos) => atualizar(r, campos)} />
        ))}
      </ol>

      {/* observações gerais */}
      <section className="obra-card p-4">
        <ObservacoesGerais
          valor={f.observacoes}
          editavel={editavel}
          onSalvar={async (observacoes) => {
            const ok = await salvarObservacoes(f.id, observacoes).catch(() => false);
            if (ok) setF((cur) => (cur ? { ...cur, observacoes } : cur));
            else setErro("Não foi possível salvar as observações.");
          }}
        />
      </section>

      {/* concluir / reabrir */}
      {f.status === "rascunho" && editavel && (
        <section className="space-y-2">
          {motivo && <p className="text-center text-sm font-semibold text-obra-suave">{motivo}</p>}
          <button
            type="button"
            className="obra-btn w-full"
            disabled={!!motivo || concluindo || salvando > 0}
            onClick={async () => {
              setConcluindo(true);
              setErro("");
              const ok = await concluirInspecao(f.id).catch(() => false);
              if (ok) setF({ ...f, status: "concluida", concluidaEm: new Date().toISOString() });
              else setErro("Não foi possível concluir. Tente de novo.");
              setConcluindo(false);
            }}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden /> {concluindo ? "Concluindo…" : "Concluir FVS"}
          </button>
        </section>
      )}
      {f.status === "concluida" && (
        <section className="space-y-2 text-center">
          {f.concluidaEm && <p className="text-sm text-obra-suave">Concluída em {new Date(f.concluidaEm).toLocaleString("pt-BR")}</p>}
          {gerencia(perfil.papel) && (
            <button
              type="button"
              className="obra-btn-claro w-full"
              onClick={async () => {
                const ok = await reabrirInspecao(f.id).catch(() => false);
                if (ok) setF({ ...f, status: "rascunho", concluidaEm: null });
                else setErro("Não foi possível reabrir.");
              }}
            >
              <RotateCcw className="h-5 w-5" aria-hidden /> Reabrir para correção
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function Item({ n, r, editavel, onChange }: { n: number; r: Resposta; editavel: boolean; onChange: (c: Partial<Pick<Resposta, "resultado" | "observacao">>) => void }) {
  const [obs, setObs] = useState(r.observacao);
  const [mostrarObs, setMostrarObs] = useState(!!r.observacao);
  const salvo = useRef(r.observacao);
  useEffect(() => {
    setObs(r.observacao);
    salvo.current = r.observacao;
  }, [r.observacao]);
  const nc = r.resultado === "NC";
  const salvarObs = () => {
    if (obs !== salvo.current) {
      salvo.current = obs;
      onChange({ observacao: obs });
    }
  };

  return (
    <li className={`obra-card overflow-hidden ${nc ? "ring-2 ring-obra-nc/40" : ""}`}>
      <div className="space-y-3 p-4">
        <div>
          <p className="font-extrabold text-obra-grafite">
            <span className="text-obra-suave">{n}.</span> {r.texto}
          </p>
          {r.criterio && <p className="mt-0.5 text-sm text-obra-suave">Critério: {r.criterio}</p>}
        </div>
        <div role="group" aria-label={`Resultado do item ${n}`} className="grid grid-cols-3 gap-2">
          {BOTOES.map(({ r: valor, curto, icone: Icone, ativo }) => {
            const marcado = r.resultado === valor;
            return (
              <button
                key={valor}
                type="button"
                disabled={!editavel}
                aria-pressed={marcado}
                aria-label={RESULTADO_ROTULO[valor]}
                title={RESULTADO_ROTULO[valor]}
                onClick={() => {
                  onChange({ resultado: marcado ? null : valor });
                  if (valor === "NC") setMostrarObs(true);
                }}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 text-sm font-extrabold transition disabled:cursor-not-allowed ${marcado ? ativo : "border-obra-borda bg-obra-card text-obra-suave"} ${!editavel && !marcado ? "opacity-50" : ""}`}
              >
                <Icone className="h-5 w-5" strokeWidth={3} aria-hidden /> {curto}
              </button>
            );
          })}
        </div>
        {mostrarObs || nc ? (
          <label className="block">
            <span className="obra-label">{nc ? "Descreva o problema *" : "Observação"}</span>
            <textarea
              className="obra-input min-h-20 py-3"
              value={obs}
              disabled={!editavel}
              placeholder={nc ? "O que está fora do critério? Onde?" : "Opcional"}
              onChange={(e) => setObs(e.target.value)}
              onBlur={salvarObs}
              aria-invalid={nc && !obs.trim()}
            />
          </label>
        ) : (
          editavel && (
            <button type="button" className="obra-link -ml-3" onClick={() => setMostrarObs(true)}>
              + Adicionar observação
            </button>
          )
        )}
      </div>
    </li>
  );
}

function ObservacoesGerais({ valor, editavel, onSalvar }: { valor: string; editavel: boolean; onSalvar: (v: string) => void }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <label className="block">
      <span className="obra-label">Observações gerais</span>
      <textarea
        className="obra-input min-h-24 py-3"
        value={v}
        disabled={!editavel}
        placeholder="Condições do serviço, equipe, materiais…"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== valor && onSalvar(v)}
      />
    </label>
  );
}
