import { loadCompany } from "./orders";
import { nextPdfPageEnd, type PdfBlock } from "./pdf-pagination";

export interface OpcoesPdf {
  obra?: string; // linha "Obra: ..." no rodapé
  empresa?: string; // nome da empresa no rodapé (padrão: dados salvos em Configurações › Empresa)
}

// Gera o PDF de um elemento da tela (html2canvas + jsPDF), em A4, sem cortar blocos marcados
// com data-pdf-block (fotos, assinaturas) nem linhas de texto entre páginas. Devolve o arquivo.
export async function gerarPdf(el: HTMLElement, opcoes: OpcoesPdf = {}): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts?.ready;
  await Promise.all(Array.from(el.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  let blocks: PdfBlock[] = [];
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: getComputedStyle(el).backgroundColor,
    useCORS: true,
    windowWidth: 800,
    onclone: (_doc, cloned) => {
      cloned.style.width = "760px";
      cloned.style.maxWidth = "none";
      const root = cloned.getBoundingClientRect();
      // Blocks plus every text line container, padded so descenders are never cut.
      blocks = Array.from(cloned.querySelectorAll("[data-pdf-block], tr, img, p, h1, h2, h3, li, dt, dd, label"))
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { top: Math.max(0, Math.floor((rect.top - root.top) * 2) - 6), bottom: Math.ceil((rect.bottom - root.top) * 2) + 10 };
        })
        .filter((b) => b.bottom > b.top);
    },
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const footerH = 12;
  const usableH = pageH - margin * 2 - footerH;
  const pxPerMm = canvas.width / imgW;
  const pagePx = Math.floor(usableH * pxPerMm);
  let offset = 0;
  while (offset < canvas.height) {
    const end = nextPdfPageEnd(offset, pagePx, canvas.height, blocks);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, end - offset);
    const context = slice.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (offset > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, slice.height / pxPerMm);
    offset = end;
  }
  const company = loadCompany();
  const companyLine = [opcoes.empresa || company.name, company.info?.split("\n")[0]].filter(Boolean).join(" — ");
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const y = pageH - margin - 6;
    pdf.setDrawColor(139, 111, 78);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageW - margin, y);
    pdf.setFontSize(8);
    pdf.setTextColor(30, 30, 30);
    if (companyLine) pdf.text(pdf.splitTextToSize(companyLine, imgW - 30)[0], margin, y + 4);
    if (opcoes.obra) pdf.text(pdf.splitTextToSize(`Obra: ${opcoes.obra}`, imgW - 30)[0], margin, y + 8);
    pdf.text(`Página ${i}/${total}`, pageW - margin, y + 4, { align: "right" });
  }
  return pdf.output("blob");
}

// Baixa um arquivo no aparelho.
export function baixarArquivo(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// O aparelho consegue compartilhar arquivos (Web Share com arquivo: celulares Android/iOS)?
export function podeCompartilharArquivo() {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["x"], "teste.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

// Compartilha o PDF (WhatsApp, e-mail…) pelo menu do celular. Sem suporte, baixa o arquivo.
// Retorna "compartilhado", "baixado" ou "cancelado".
export async function compartilharArquivo(arquivo: Blob, nome: string, titulo: string): Promise<"compartilhado" | "baixado" | "cancelado"> {
  const file = new File([arquivo], nome, { type: arquivo.type || "application/pdf" });
  if (podeCompartilharArquivo() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return "compartilhado";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelado";
      throw e;
    }
  }
  baixarArquivo(arquivo, nome);
  return "baixado";
}

// Compatível com OS e Vistoria: gera e baixa.
export async function exportElementToPdf(el: HTMLElement, filename: string, work = "") {
  baixarArquivo(await gerarPdf(el, { obra: work }), filename);
}
