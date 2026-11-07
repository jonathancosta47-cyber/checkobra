export interface PdfBlock { top: number; bottom: number }

/** Find a safe cut, including blocks intersecting a cut moved by another block. */
export function nextPdfPageEnd(offset: number, pageHeight: number, totalHeight: number, blocks: PdfBlock[]): number {
  let end = Math.min(offset + pageHeight, totalHeight);
  while (true) {
    const crossings = blocks.filter(block =>
      block.top > offset && block.top < end && block.bottom > end &&
      block.bottom - block.top <= pageHeight,
    );
    if (!crossings.length) return end;
    end = Math.min(...crossings.map(block => block.top));
  }
}