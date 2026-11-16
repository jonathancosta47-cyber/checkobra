import { useState } from "react";
import { Download, FileText, Printer, Share2 } from "lucide-react";
import { baixarArquivo, compartilharArquivo, podeCompartilharArquivo } from "@/lib/pdf";

// Botões do relatório (Vistoria e FVS): Gerar PDF, Baixar, Imprimir e Compartilhar.
// "gerar" monta o PDF na hora; "salvo" é um PDF já guardado (ex.: FVS concluída), usado para baixar/compartilhar.
export function AcoesPdf({
  nome,
  titulo,
  gerar,
  salvo,
  rotuloGerar = "Gerar PDF",
}: {
  nome: string;
  titulo: string;
  gerar: () => Promise<Blob>;
  salvo?: (() => Promise<Blob>) | undefined;
  rotuloGerar?: string;
}) {
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<"" | "gerar" | "baixar" | "compartilhar">("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  // usa o PDF já gerado nesta tela, ou o salvo, ou gera agora
  const obter = async () => pdf ?? (salvo ? await salvo() : await gerar());
  const executar = async (qual: typeof busy, fn: () => Promise<void>) => {
    setBusy(qual);
    setErro("");
    setAviso("");
    try {
      await fn();
    } catch {
      setErro("Não foi possível preparar o PDF. Verifique a internet e tente de novo.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="no-print space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          className="obra-btn text-sm"
          disabled={!!busy}
          onClick={() =>
            executar("gerar", async () => {
              const novo = await gerar();
              setPdf(novo);
              setAviso("PDF pronto: baixe, compartilhe ou imprima.");
            })
          }
        >
          <FileText className="h-5 w-5" aria-hidden /> {busy === "gerar" ? "Gerando…" : rotuloGerar}
        </button>
        <button type="button" className="obra-btn-claro text-sm" disabled={!!busy} onClick={() => executar("baixar", async () => baixarArquivo(await obter(), nome))}>
          <Download className="h-5 w-5" aria-hidden /> {busy === "baixar" ? "Preparando…" : "Baixar"}
        </button>
        <button type="button" className="obra-btn-claro text-sm" disabled={!!busy} onClick={() => window.print()}>
          <Printer className="h-5 w-5" aria-hidden /> Imprimir
        </button>
        <button
          type="button"
          className="obra-btn-claro text-sm"
          disabled={!!busy}
          onClick={() =>
            executar("compartilhar", async () => {
              const r = await compartilharArquivo(await obter(), nome, titulo);
              if (r === "baixado") setAviso("Este aparelho não compartilha arquivos; o PDF foi baixado.");
            })
          }
          title={podeCompartilharArquivo() ? "Compartilhar pelo celular" : "Neste aparelho, o PDF é baixado"}
        >
          <Share2 className="h-5 w-5" aria-hidden /> {busy === "compartilhar" ? "Preparando…" : "Compartilhar"}
        </button>
      </div>
      {aviso && <p role="status" className="obra-aviso">{aviso}</p>}
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
    </div>
  );
}
