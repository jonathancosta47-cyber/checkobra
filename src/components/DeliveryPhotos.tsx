import { useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/orders";
export function DeliveryPhotos({
  value,
  onChange,
  label = "Adicionar fotos",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {value.map((src, i) => (
          <div key={i} className="relative aspect-square">
            <img
              src={src}
              alt={`Registro ${i + 1}`}
              className="h-full w-full rounded-md object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-1 top-1"
              aria-label={`Remover foto ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <Camera className="h-4 w-4" />
        {busy ? "Processando…" : label}
        <input
          disabled={busy}
          aria-label={label}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            setBusy(true);
            setError("");
            try {
              const images = await Promise.all(files.map((f) => compressImage(f)));
              onChange([...value, ...images]);
            } catch {
              setError("Não foi possível carregar a foto.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
