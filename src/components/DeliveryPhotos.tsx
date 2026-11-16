import { compressImage } from "@/lib/imagens";
import { CampoFotos } from "@/components/CampoFotos";

// Fotos da Vistoria de entrega: mesmas fotos de antes (data URLs dentro da vistoria),
// agora pelo campo compartilhado com a FVS (câmera/galeria, ampliar e remover).
export function DeliveryPhotos({
  value,
  onChange,
  label = "Fotos",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) {
  return (
    <CampoFotos
      rotulo={label}
      fotos={value.map((src, i) => ({ id: String(i), src }))}
      onAdicionar={async (arquivos) => {
        const novas = await Promise.all(arquivos.map((f) => compressImage(f)));
        onChange([...value, ...novas]);
      }}
      onRemover={(id) => onChange(value.filter((_, i) => String(i) !== id))}
    />
  );
}
