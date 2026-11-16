import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, CheckCircle2, FileCheck2, Lock, Minus, RotateCcw, Trash2, X } from "lucide-react";
import {
  baixarPdfSalvo,
  concluirInspecao,
  definirEmpreiteiro,
  enviarFotoFvs,
  excluirInspecao,
  lerInspecao,
  listarFotos,
  reabrirInspecao,
  removerFotoFvs,
  salvarAssinaturas,
  salvarObservacoes,
  salvarPdfFvs,
  salvarResposta,
} from "@/lib/fvs-store";
import { listarEmpreiteiros } from "@/lib/configuracoes-store";
import { empreiteirosParaServico, type Empreiteiro } from "@/lib/configuracoes";
import {
  assinaturasCompletas,
  contarRespostas,
  gerencia,
  motivoParaNaoConcluir,
  nomePdfFvs,
  numeroFvs,
  PAPEL_ASSINATURA,
  podeEditar,
  podeExcluir,
  progresso,
  RESULTADO_ROTULO,
  type Assinatura,
  type FotoFvs,
  type Inspecao,
  type Resposta,
  type Resultado,
} from "@/lib/fvs-db";
import { gerarPdf } from "@/lib/pdf";
import { Etiqueta, Pagina, Pilulas, Progresso } from "@/components/modulos";
import { CampoFotos } from "@/components/CampoFotos";
import { SignaturePad } from "@/components/SignaturePad";
import { AcoesPdf } from "@/components/AcoesPdf";
import { FvsRelatorio } from "@/components/FvsRelatorio";
import { usePerfil } from "@/components/PerfilContext";

export const Route = createFileRoute("/fvs/$id")({
  head: () => ({
    meta: [
      { title: "FVS — CheckObra" },
      { name: "description", content: "Preencha a ficha de verificação de serviço, com fotos, assinaturas e PDF." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return (
    <Pagina className="pt-5">
      <Ficha key={id} id={id} />
    </Pagina>
  );
}

const BOTOES: { r: Resultado; curto: string; icone: typeof Check; ativo: string }[] = [
  { r: "C", curto: "C", icone: Check, ativo: "border-obra-ok bg-obra-ok-fundo text-obra-ok" },
  { r: "NC", curto: "NC", icone: X, ativo: "border-obra-nc bg-obra-nc-fundo text-obra-nc" },
  { r: "NA", curto: "N/A", icone: Minus, ativo: "border-obra-suave bg-obra-fundo text-obra-grafite" },
];

type Aba = "preencher" | "relatorio";
const proximoQuadro = () => new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok())));

// Espera o relatório aparecer na tela com as fotos prontas (até 15 s) antes de gerar o PDF.
async function relatorioPronto(ref: React.RefObject<HTMLElement | null>) {
  const limite = Date.now() + 15_000;
  while (Date.now() < limite) {
    await proximoQuadro();
    if (ref.current?.dataset["fotosProntas"] === "sim") return ref.current;
  }
  if (!ref.current) throw new Error("relatório indisponível");
  return ref.current;
}

function Ficha({ id }: { id: string }) {
  const perfil = usePerfil();
  const navigate = useNavigate();
  const [excluindo, setExcluindo] = useState(false);
  const [f, setF] = useState<Inspecao | null | undefined>(undefined);
  const [fotos, setFotos] = useState<FotoFvs[]>([]);
  const [aba, setAba] = useState<Aba>("preencher");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(0);
  const [concluindo, setConcluindo] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<"" | "gerando" | "salvo" | "falhou">("");
  const relatorio = useRef<HTMLElement>(null);

  useEffect(() => {
    lerInspecao(id)
      .then((i) => {
        setF(i);
        if (i?.status === "concluida") setAba("relatorio");
      })
      .catch(() => setErro("Não foi possível carregar a FVS."));
    listarFotos(id)
      .then(setFotos)
      .catch(() => setFotos([]));
  }, [id]);

  // Gera o PDF a partir do relatório da tela e guarda no Storage (FVS concluída).
  const gerarESalvarPdf = useCallback(
    async (fvs: Inspecao) => {
      setPdfStatus("gerando");
      try {
        setAba("relatorio");
        const el = await relatorioPronto(relatorio);
        const pdf = await gerarPdf(el, { obra: [fvs.obra, fvs.local].filter(Boolean).join(" — "), empresa: perfil.empresaNome });
        const caminho = await salvarPdfFvs({ empresaId: perfil.empresaId, empreendimentoId: fvs.empreendimentoId, inspecaoId: fvs.id, nome: nomePdfFvs(fvs.numero, fvs.modelo), pdf });
        setF((cur) => (cur ? { ...cur, pdfPath: caminho, pdfGeradoEm: new Date().toISOString() } : cur));
        setPdfStatus("salvo");
      } catch {
        setPdfStatus("falhou");
      }
    },
    [perfil.empresaId, perfil.empresaNome],
  );

  if (f === undefined) return <p role="status" className="py-10 text-center text-obra-suave">{erro || "Carregando…"}</p>;
  if (f === null) return <p className="obra-card p-5 text-center text-obra-suave">FVS não encontrada ou sem acesso.</p>;

  const editavel = podeEditar(perfil, f);
  const contagem = contarRespostas(f.respostas);
  const fotosPorResposta = fotos.reduce<Record<string, number>>((m, x) => ({ ...m, [x.respostaId]: (m[x.respostaId] ?? 0) + 1 }), {});
  const assinaturas = assinaturasCompletas(f.assinaturas, { inspetor: f.inspetorNome || perfil.nome, empreiteiro: f.empreiteiroNome });
  const motivo = motivoParaNaoConcluir(f.respostas, fotosPorResposta, assinaturas);
  const nomePdf = nomePdfFvs(f.numero, f.modelo);

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

  const adicionarFotos = async (r: Resposta, arquivos: File[]) => {
    for (const arquivo of arquivos) {
      const nova = await enviarFotoFvs({
        empresaId: perfil.empresaId,
        empreendimentoId: f.empreendimentoId,
        inspecaoId: f.id,
        respostaId: r.id,
        arquivo,
        ordem: (fotosPorResposta[r.id] ?? 0) + 1,
      });
      setFotos((fs) => [...fs, nova]);
    }
  };
  const removerFoto = async (fotoId: string) => {
    const foto = fotos.find((x) => x.id === fotoId);
    if (!foto || !confirm("Remover esta foto?")) return;
    const ok = await removerFotoFvs(foto).catch(() => false);
    if (ok) setFotos((fs) => fs.filter((x) => x.id !== fotoId));
    else setErro("Não foi possível remover a foto.");
  };

  const mudarAssinatura = async (papel: Assinatura["papel"], campos: Partial<Assinatura>) => {
    const novas = assinaturas.map((a) => (a.papel === papel ? { ...a, ...campos } : a));
    setF({ ...f, assinaturas: novas });
    const ok = await salvarAssinaturas(f.id, novas).catch(() => false);
    if (!ok) setErro("Não foi possível salvar a assinatura.");
  };

  return (
    <div className="space-y-4">
      {/* cabeçalho da ficha */}
      <section className="obra-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-obra-laranja-texto">{numeroFvs(f.numero)}</p>
            <h2 className="text-xl font-extrabold leading-tight text-obra-grafite">
              {f.modelo} <span className="text-sm font-bold text-obra-suave">v{f.modeloVersao}</span>
            </h2>
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

      <Pilulas
        label="Ver"
        opcoes={[
          { v: "preencher" as Aba, l: f.status === "concluida" ? "Itens" : "Preencher" },
          { v: "relatorio" as Aba, l: "Relatório / PDF" },
        ]}
        valor={aba}
        onChange={setAba}
      />

      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {aba === "preencher" ? (
        <>
          {/* empreiteiro responsável (cadastro em Configurações › Empreiteiros) */}
          <section className="obra-card p-4">
            <EmpreiteiroResponsavel
              valor={f.empreiteiroId}
              servico={f.modeloServico}
              editavel={editavel}
              onEscolher={async (empreiteiroId, nome) => {
                const antes = { id: f.empreiteiroId, nome: f.empreiteiroNome };
                setF({ ...f, empreiteiroId, empreiteiroNome: nome });
                const ok = await definirEmpreiteiro(f.id, empreiteiroId).catch(() => false);
                if (!ok) {
                  setF((cur) => (cur ? { ...cur, empreiteiroId: antes.id, empreiteiroNome: antes.nome } : cur));
                  setErro("Não foi possível salvar o empreiteiro.");
                }
              }}
            />
          </section>

          {/* itens */}
          <ol className="space-y-3">
            {f.respostas.map((r, k) => (
              <Item
                key={r.id}
                n={k + 1}
                r={r}
                editavel={editavel}
                fotos={fotos.filter((x) => x.respostaId === r.id)}
                onChange={(campos) => atualizar(r, campos)}
                onAdicionarFotos={(arquivos) => adicionarFotos(r, arquivos)}
                onRemoverFoto={removerFoto}
              />
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

          {/* assinaturas */}
          <section className="obra-card space-y-5 p-4" aria-label="Assinaturas">
            <h2 className="text-lg font-extrabold text-obra-grafite">Assinaturas</h2>
            {assinaturas.map((a) => (
              <div key={a.papel} className="space-y-2">
                <label className="block">
                  <span className="obra-label">
                    {PAPEL_ASSINATURA[a.papel]}
                    {a.papel === "inspetor" ? " *" : ""}
                  </span>
                  <input
                    className="obra-input"
                    value={a.nome}
                    disabled={!editavel}
                    placeholder="Nome de quem assina"
                    onChange={(e) => setF({ ...f, assinaturas: assinaturas.map((x) => (x.papel === a.papel ? { ...x, nome: e.target.value } : x)) })}
                    onBlur={(e) => void mudarAssinatura(a.papel, { nome: e.target.value })}
                  />
                </label>
                {editavel ? (
                  <SignaturePad value={a.imagem} onChange={(imagem) => void mudarAssinatura(a.papel, { imagem })} />
                ) : a.imagem ? (
                  <img src={a.imagem} alt={`Assinatura — ${PAPEL_ASSINATURA[a.papel]}`} className="h-28 w-full rounded-xl bg-obra-fundo object-contain" />
                ) : (
                  <p className="text-sm text-obra-suave">Sem assinatura.</p>
                )}
              </div>
            ))}
          </section>

          {/* concluir */}
          {f.status === "rascunho" && editavel && (
            <section className="space-y-2">
              {motivo && <p className="text-center text-sm font-semibold text-obra-nc">{motivo}</p>}
              <button
                type="button"
                className="obra-btn w-full"
                disabled={!!motivo || concluindo || salvando > 0}
                onClick={async () => {
                  setConcluindo(true);
                  setErro("");
                  const ok = await concluirInspecao(f.id).catch(() => false);
                  setConcluindo(false);
                  if (!ok) return setErro("Não foi possível concluir. Confira os itens, fotos e assinatura e tente de novo.");
                  const concluida = { ...f, assinaturas, status: "concluida" as const, concluidaEm: new Date().toISOString() };
                  setF(concluida);
                  // gera e guarda o PDF oficial automaticamente
                  void gerarESalvarPdf(concluida);
                }}
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden /> {concluindo ? "Concluindo…" : "Concluir FVS e gerar PDF"}
              </button>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="obra-card space-y-3 p-4">
            {f.status === "concluida" ? (
              <p className="flex items-center gap-2 text-sm text-obra-grafite" aria-live="polite">
                <FileCheck2 className="h-5 w-5 shrink-0 text-obra-ok" aria-hidden />
                {pdfStatus === "gerando"
                  ? "Gerando e salvando o PDF oficial…"
                  : f.pdfPath
                    ? `PDF oficial salvo em ${new Date(f.pdfGeradoEm ?? Date.now()).toLocaleString("pt-BR")}. Também disponível em Relatórios.`
                    : pdfStatus === "falhou"
                      ? "Não foi possível salvar o PDF agora (verifique a internet)."
                      : "O PDF oficial ainda não foi salvo."}
              </p>
            ) : (
              <p className="obra-aviso">Prévia: o PDF oficial é gerado e salvo ao concluir a FVS.</p>
            )}
            {f.status === "concluida" && !f.pdfPath && pdfStatus !== "gerando" && (
              <button type="button" className="obra-btn w-full" onClick={() => void gerarESalvarPdf(f)}>
                <FileCheck2 className="h-5 w-5" aria-hidden /> Gerar e salvar PDF oficial
              </button>
            )}
            <AcoesPdf
              nome={nomePdf}
              titulo={`${numeroFvs(f.numero)} — ${f.modelo}`}
              gerar={async () => {
                const el = await relatorioPronto(relatorio);
                return gerarPdf(el, { obra: [f.obra, f.local].filter(Boolean).join(" — "), empresa: perfil.empresaNome });
              }}
              salvo={f.pdfPath ? () => baixarPdfSalvo(f.pdfPath!) : undefined}
            />
          </section>
          <FvsRelatorio ref={relatorio} fvs={{ ...f, assinaturas }} fotos={fotos} empresaNome={perfil.empresaNome} />
        </>
      )}

      {f.status === "concluida" && gerencia(perfil.papel) && (
        <section className="space-y-2 text-center">
          {f.concluidaEm && <p className="text-sm text-obra-suave">Concluída em {new Date(f.concluidaEm).toLocaleString("pt-BR")}</p>}
          <button
            type="button"
            className="obra-btn-claro w-full"
            onClick={async () => {
              const ok = await reabrirInspecao(f.id).catch(() => false);
              if (ok) {
                setF({ ...f, status: "rascunho", concluidaEm: null });
                setAba("preencher");
              } else setErro("Não foi possível reabrir.");
            }}
          >
            <RotateCcw className="h-5 w-5" aria-hidden /> Reabrir para correção
          </button>
        </section>
      )}

      {podeExcluir(perfil, f) && (
        <section className="pt-2 text-center">
          <button
            type="button"
            className="obra-link text-obra-nc decoration-obra-nc"
            disabled={excluindo}
            onClick={async () => {
              const aviso =
                f.status === "concluida"
                  ? `Excluir a ${numeroFvs(f.numero)} concluída? Itens, fotos, assinaturas e o PDF salvo serão apagados. Não dá para desfazer.`
                  : `Excluir a ${numeroFvs(f.numero)}? Itens, fotos e assinaturas serão apagados. Não dá para desfazer.`;
              if (!confirm(aviso)) return;
              setExcluindo(true);
              setErro("");
              const ok = await excluirInspecao(f.id).catch(() => false);
              if (ok) navigate({ to: "/fvs", replace: true });
              else {
                setExcluindo(false);
                setErro("Não foi possível excluir. Verifique a internet ou sua permissão.");
              }
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden /> {excluindo ? "Excluindo…" : "Excluir FVS"}
          </button>
        </section>
      )}
    </div>
  );
}

function Item({
  n,
  r,
  editavel,
  fotos,
  onChange,
  onAdicionarFotos,
  onRemoverFoto,
}: {
  n: number;
  r: Resposta;
  editavel: boolean;
  fotos: FotoFvs[];
  onChange: (c: Partial<Pick<Resposta, "resultado" | "observacao">>) => void;
  onAdicionarFotos: (arquivos: File[]) => Promise<void>;
  onRemoverFoto: (id: string) => void | Promise<void>;
}) {
  const [obs, setObs] = useState(r.observacao);
  const [mostrarObs, setMostrarObs] = useState(!!r.observacao);
  const [mostrarFotos, setMostrarFotos] = useState(fotos.length > 0);
  const salvo = useRef(r.observacao);
  useEffect(() => {
    setObs(r.observacao);
    salvo.current = r.observacao;
  }, [r.observacao]);
  const nc = r.resultado === "NC";
  const fotoExigida = r.exige_foto && (r.resultado === "C" || r.resultado === "NC");
  const salvarObs = () => {
    if (obs !== salvo.current) {
      salvo.current = obs;
      onChange({ observacao: obs });
    }
  };

  return (
    <li className={`obra-card overflow-hidden ${nc ? "ring-2 ring-obra-nc/50" : ""}`}>
      <div className="space-y-3 p-4">
        <div>
          <p className="font-extrabold text-obra-grafite">
            <span className="text-obra-suave">{n}.</span> {r.texto}
          </p>
          {r.criterio && <p className="mt-0.5 text-sm text-obra-suave">Critério: {r.criterio}</p>}
          {r.exige_foto && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-obra-bege px-2 py-0.5 text-xs font-bold text-obra-grafite">
              <Camera className="h-3.5 w-3.5" aria-hidden /> Exige foto
            </p>
          )}
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
                  if (valor === "NC") {
                    setMostrarObs(true);
                    setMostrarFotos(true);
                  }
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

        {/* fotos: abertas em NC, quando o modelo exige ou quando já há fotos */}
        {mostrarFotos || nc || fotoExigida || fotos.length > 0 ? (
          <CampoFotos
            rotulo={nc ? "Fotos da não conformidade" : "Fotos"}
            fotos={fotos.map((x) => ({ id: x.id, src: x.url }))}
            onAdicionar={onAdicionarFotos}
            onRemover={onRemoverFoto}
            desabilitado={!editavel}
            destaque={nc}
            exigida={fotoExigida}
          />
        ) : (
          editavel && (
            <button type="button" className="obra-link -ml-3" onClick={() => setMostrarFotos(true)}>
              + Adicionar fotos
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

function EmpreiteiroResponsavel({
  valor,
  servico,
  editavel,
  onEscolher,
}: {
  valor: string | null;
  servico: string;
  editavel: boolean;
  onEscolher: (id: string | null, nome: string) => void;
}) {
  const [lista, setLista] = useState<Empreiteiro[] | null>(null);
  useEffect(() => {
    listarEmpreiteiros()
      .then(setLista)
      .catch(() => setLista([]));
  }, []);
  const opcoes = empreiteirosParaServico(lista ?? [], servico);
  const atual = (lista ?? []).find((e) => e.id === valor);
  return (
    <label className="block">
      <span className="obra-label">Empreiteiro responsável</span>
      <select
        className="obra-input"
        value={valor ?? ""}
        disabled={!editavel || lista === null}
        onChange={(e) => onEscolher(e.target.value || null, (lista ?? []).find((x) => x.id === e.target.value)?.nome ?? "")}
      >
        <option value="">{lista === null ? "Carregando…" : "Sem empreiteiro definido"}</option>
        {/* mantém visível o escolhido mesmo se tiver sido desativado depois */}
        {atual && !atual.ativo && <option value={atual.id}>{atual.nome} (inativo)</option>}
        {opcoes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
            {e.executaServico ? ` — executa ${servico}` : ""}
          </option>
        ))}
      </select>
      {lista !== null && lista.length === 0 && (
        <span className="mt-1.5 block text-xs text-obra-suave">Nenhum empreiteiro cadastrado. O admin ou um engenheiro cadastra em Configurações.</span>
      )}
    </label>
  );
}
