import { useEffect, useState } from "react";

// Explicit pixel size keeps aspect ratio in html2canvas (PDF) and print, where object-fit is unreliable.
export function fitLogo(w: number, h: number, maxW = 180, maxH = 72) {
  if (!w || !h) return { width: maxW, height: maxH };
  const s = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

export function CompanyLogo({ src, maxW = 180, maxH = 72 }: { src: string; maxW?: number; maxH?: number }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize(fitLogo(img.naturalWidth, img.naturalHeight, maxW, maxH));
    img.src = src;
  }, [src, maxW, maxH]);
  if (!size) return null;
  return <img src={src} alt="Logotipo" width={size.width} height={size.height} style={{ width: size.width, height: size.height, maxWidth: "none" }} className="shrink-0" />;
}
