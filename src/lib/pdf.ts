export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  await document.fonts?.ready;
  await Promise.all(Array.from(el.querySelectorAll("img")).map(img => img.decode().catch(() => undefined)));
  let blocks: { top: number; bottom: number }[] = [];
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: getComputedStyle(el).backgroundColor, useCORS: true, windowWidth: 800,
    onclone: (_doc, cloned) => {
      cloned.style.width = "760px";
      cloned.style.maxWidth = "none";
      const root = cloned.getBoundingClientRect();
      blocks = Array.from(cloned.querySelectorAll("[data-pdf-block], tr, img")).map(node => {
        const rect = node.getBoundingClientRect();
        return { top: (rect.top-root.top)*2, bottom: (rect.bottom-root.top)*2 };
      });
    },
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const pxPerMm = canvas.width / imgW;
  const pagePx = Math.floor(usableH * pxPerMm);
  let offset = 0;
  while (offset < canvas.height) {
    let end = Math.min(offset + pagePx, canvas.height);
    const crossings = blocks.filter(b => b.top > offset + pagePx * 0.55 && b.top < end && b.bottom > end);
    if (crossings.length) end = Math.floor(Math.min(...crossings.map(b => b.top)));
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
  pdf.save(filename);
}
