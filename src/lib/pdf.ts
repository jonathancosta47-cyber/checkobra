export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 800 });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const usableH = pageH - margin * 2;
  const img = canvas.toDataURL("image/jpeg", 0.92);
  let offset = 0;
  while (offset < imgH) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", margin, margin - offset, imgW, imgH);
    offset += usableH;
  }
  pdf.save(filename);
}
