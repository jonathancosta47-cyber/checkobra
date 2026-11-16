// Imagens: reduzir no aparelho antes de guardar ou enviar (usado por OS, Vistoria, FVS e empreendimentos).

// Reduz a imagem para no máximo `max` px no maior lado e devolve como data URL (JPEG 70%).
export function compressImage(file: File, max = 1200, type = "image/jpeg"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(type, 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// data URL → Blob (para enviar ao Storage).
export async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

// Imagem já comprimida, pronta para enviar.
export async function comprimirParaEnvio(file: File, max = 1600): Promise<Blob> {
  return dataUrlParaBlob(await compressImage(file, max));
}
