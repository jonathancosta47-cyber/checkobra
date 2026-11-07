import { loadCompany } from "./orders";
import { nextPdfPageEnd, type PdfBlock } from "./pdf-pagination";

export async function exportElementToPdf(el: HTMLElement, filename: string, work = "") {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  await document.fonts?.ready;
  await Promise.all(Array.from(el.querySelectorAll("img")).map(img => img.decode().catch(() => undefined)));
  let blocks: PdfBlock[] = [];
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: getComputedStyle(el).backgroundColor, useCORS: true, windowWidth: 800,
    onclone: (_doc, cloned) => {
      cloned.style.width = "760px";
      cloned.style.maxWidth = "none";
      const root = cloned.getBoundingClientRect();
      // Blocks plus every text line container, padded so descenders are never cut.
      blocks = Array.from(cloned.querySelectorAll("[data-pdf-block], tr, img, p, h1, h2, h3, li, dt, dd, label")).map(node => {
        const rect = node.getBoundingClientRect();
        return { top: Math.max(0, Math.floor((rect.top-root.top)*2) - 6), bottom: Math.ceil((rect.bottom-root.top)*2) + 10 };
      }).filter(b => b.bottom > b.top);
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
    slice.height = Math.max(1, end-offset);
    const context = slice.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (offset > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, slice.height/pxPerMm);
    offset = end;
  }
  const company = loadCompany();
  const companyLine = [company.name, company.info?.split("\n")[0]].filter(Boolean).join(" — ");
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const y = pageH - margin - 6;
    pdf.setDrawColor(139, 111, 78);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageW - margin, y);
    pdf.setFontSize(8);
    pdf.setTextColor(47, 74, 58);
    if (companyLine) pdf.text(pdf.splitTextToSize(companyLine, imgW - 30)[0], margin, y + 4);
    if (work) pdf.text(pdf.splitTextToSize(`Obra: ${work}`, imgW - 30)[0], margin, y + 8);
    pdf.text(`Página ${i}/${total}`, pageW - margin, y + 4, { align: "right" });
  }
  pdf.save(filename);
}
