import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Camera, Plus, Save, Trash2 } from "lucide-react";
import { moverItem, servicosUnicos, validarModelo, type ItemModelo, type ModeloResumo } from "@/lib/configuracoes";
import { listarEmpreiteiros, listarModelosAtuais, salvarModelo } from "@/lib/configuracoes-store";

// Serviços já usados em modelos e empreiteiros (sugestões no campo "Serviço").
export function useServicosSugeridos() {
  const [servicos, setServicos] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([listarModelosAtuais(), listarEmpreiteiros()])
      .then(([ms, es]) => setServicos(servicosUnicos([ms.map((m) => m.servico), ...es.map((e) => e.servicos)])))
      .catch(() => setServicos([]));
  }, []);
  return servicos;
}

const itemVazio = (): ItemModelo => ({ texto: "", criterio: "", exige_foto: false });

// Criar ou editar um modelo de FVS. Salvar um modelo existente gera a próxima versão;
// as FVS já preenchidas continuam com a versão que usaram.
export function EditorModelo({
  inicial,
  padrao = false,
  servicosSugeridos = [],
  onSalvo,
}: {
  inicial: ModeloResumo | null;
  padrao?: boolean;
  servicosSugeridos?: string[];
  onSalvo: (id: string) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [servico, setServico] = useState(inicial?.servico ?? "");
  const [itens, setItens] = useState<ItemModelo[]>(inicial?.itens.length ? inicial.itens.map(({ texto, criterio, exige_foto }) => ({ texto, criterio, exige_foto })) : [itemVazio()]);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const mudar = (k: number, p: Partial<ItemModelo>) => setItens(itens.map((it, j) => (j === k ? { ...it, ...p } : it)));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const invalido = validarModelo({ nome, itens });
        if (invalido) return setErro(invalido);
        setBusy(true);
        setErro("");
        try {
          onSalvo(await salvarModelo({ id: inicial?.id ?? null, nome, servico, itens, padrao }));
        } catch {
          setErro("Não foi possível salvar o modelo. Verifique a internet e tente de novo.");
          setBusy(false);
        }
      }}
    >
      <section className="obra-card space-y-4 p-4">
        {inicial && (
          <p className="obra-aviso">
            Você está editando a <strong>versão {inicial.versao}</strong>. Ao salvar, vira a versão {inicial.versao + 1}; as FVS já feitas
            continuam com a versão que usaram.
          </p>
        )}
        <label className="block">
          <span className="obra-label">Nome do modelo *</span>
          <input className="obra-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Alvenaria de vedação" />
        </label>
        <label className="block">
          <span className="obra-label">Serviço</span>
          <input className="obra-input" value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex.: Alvenaria" list="servicos-sugeridos" />
          <datalist id="servicos-sugeridos">
            {servicosSugeridos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <span className="mt-1.5 block text-xs text-obra-suave">Usado para sugerir os empreiteiros que executam este serviço.</span>
        </label>
      </section>

      <section className="space-y-3" aria-label="Itens de verificação">
        <h2 className="text-lg font-extrabold text-obra-grafite">Itens de verificação</h2>
        <ol className="space-y-3">
          {itens.map((it, k) => (
            <li key={k} className="obra-card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-obra-suave">Item {k + 1}</span>
                <div className="flex">
                  <button type="button" className="obra-icone-btn h-11 w-11 bg-transparent" onClick={() => setItens(moverItem(itens, k, k - 1))} disabled={k === 0} aria-label={`Subir item ${k + 1}`}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="obra-icone-btn h-11 w-11 bg-transparent" onClick={() => setItens(moverItem(itens, k, k + 1))} disabled={k === itens.length - 1} aria-label={`Descer item ${k + 1}`}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="obra-icone-btn h-11 w-11 bg-transparent text-obra-nc" onClick={() => setItens(itens.filter((_, j) => j !== k))} disabled={itens.length === 1} aria-label={`Remover item ${k + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="obra-label">Descrição *</span>
                <input className="obra-input" value={it.texto} onChange={(e) => mudar(k, { texto: e.target.value })} placeholder="O que verificar" />
              </label>
              <label className="block">
                <span className="obra-label">Critério de aceitação</span>
                <input className="obra-input" value={it.criterio} onChange={(e) => mudar(k, { criterio: e.target.value })} placeholder="Ex.: desvio máximo de 1 cm" />
              </label>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-obra-fundo px-4">
                <input type="checkbox" className="h-5 w-5 accent-[var(--obra-laranja-forte)]" checked={it.exige_foto} onChange={(e) => mudar(k, { exige_foto: e.target.checked })} />
                <Camera className="h-4 w-4 text-obra-suave" aria-hidden />
                <span className="text-sm font-bold text-obra-grafite">Exige foto</span>
              </label>
            </li>
          ))}
        </ol>
        <button type="button" className="obra-btn-claro w-full" onClick={() => setItens([...itens, itemVazio()])}>
          <Plus className="h-5 w-5" aria-hidden /> Adicionar item
        </button>
      </section>

      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
      <button type="submit" className="obra-btn w-full" disabled={busy}>
        <Save className="h-5 w-5" aria-hidden /> {busy ? "Salvando…" : inicial ? `Salvar versão ${inicial.versao + 1}` : padrao ? "Publicar modelo padrão" : "Criar modelo"}
      </button>
    </form>
  );
}
