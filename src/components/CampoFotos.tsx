import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from "lucide-react";

export interface FotoCampo {
  id: string;
  src: string; // data URL (Vistoria/OS) ou link temporário do Storage (FVS)
}

// Campo de fotos usado na Vistoria e na FVS: câmera ou galeria, miniaturas, ampliar e remover.
export function CampoFotos({
  fotos,
  onAdicionar,
  onRemover,
  desabilitado = false,
  destaque = false,
  exigida = false,
  rotulo = "Fotos",
}: {
  fotos: FotoCampo[];
  onAdicionar: (arquivos: File[]) => Promise<void>;
  onRemover: (id: string) => void | Promise<void>;
  desabilitado?: boolean;
  destaque?: boolean; // item não conforme: fotos maiores e área em evidência
  exigida?: boolean; // o modelo exige foto neste item
  rotulo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);

  const adicionar = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? []).filter((f) => f.type.startsWith("image/"));
    if (!arquivos.length) return;
    setBusy(true);
    setErro("");
    try {
      await onAdicionar(arquivos);
    } catch {
      setErro("Não foi possível adicionar a foto. Verifique a internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const faltando = exigida && fotos.length === 0;
  return (
    <div className={`space-y-2 ${destaque ? "rounded-2xl bg-obra-nc-fundo p-3" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-bold ${destaque ? "text-obra-nc" : "text-obra-grafite"}`}>
          {rotulo}
          {fotos.length > 0 && ` (${fotos.length})`}
        </span>
        {faltando && <span className="rounded-full bg-obra-nc-fundo px-2 py-0.5 text-xs font-extrabold text-obra-nc">Foto obrigatória</span>}
      </div>

      {fotos.length > 0 && (
        <ul className={`grid gap-2 ${destaque ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-4"}`}>
          {fotos.map((f, k) => (
            <li key={f.id} className="relative aspect-square overflow-hidden rounded-xl bg-obra-fundo">
              <button type="button" className="h-full w-full" onClick={() => setAberta(k)} aria-label={`Ampliar foto ${k + 1}`}>
                <img src={f.src} alt={`Foto ${k + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </button>
              {!desabilitado && (
                <button
                  type="button"
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-obra-grafite/80 text-white"
                  onClick={() => void onRemover(f.id)}
                  aria-label={`Remover foto ${k + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!desabilitado && (
        <div className="grid grid-cols-2 gap-2">
          <label className={`obra-btn-claro cursor-pointer text-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <Camera className="h-5 w-5" aria-hidden /> {busy ? "Enviando…" : "Câmera"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }} />
          </label>
          <label className={`obra-btn-claro cursor-pointer text-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <ImagePlus className="h-5 w-5" aria-hidden /> Galeria
            <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      )}
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {aberta !== null && fotos[aberta] && (
        <VisualizadorFoto fotos={fotos} indice={aberta} onTrocar={setAberta} onFechar={() => setAberta(null)} />
      )}
    </div>
  );
}

// Foto em tela cheia, com anterior/próxima (setas do teclado também funcionam).
export function VisualizadorFoto({ fotos, indice, onTrocar, onFechar }: { fotos: FotoCampo[]; indice: number; onTrocar: (i: number) => void; onFechar: () => void }) {
  const total = fotos.length;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight") onTrocar((indice + 1) % total);
      if (e.key === "ArrowLeft") onTrocar((indice - 1 + total) % total);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, total, onTrocar, onFechar]);
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label={`Foto ${indice + 1} de ${total}`}>
      <img src={fotos[indice]!.src} alt={`Foto ${indice + 1} de ${total}`} className="max-h-full max-w-full object-contain" />
      <button type="button" className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" onClick={onFechar} aria-label="Fechar">
        <X className="h-6 w-6" aria-hidden />
      </button>
      {total > 1 && (
        <>
          <button type="button" className="absolute left-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" onClick={() => onTrocar((indice - 1 + total) % total)} aria-label="Foto anterior">
            <ChevronLeft className="h-7 w-7" aria-hidden />
          </button>
          <button type="button" className="absolute right-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white" onClick={() => onTrocar((indice + 1) % total)} aria-label="Próxima foto">
            <ChevronRight className="h-7 w-7" aria-hidden />
          </button>
          <p className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-sm font-bold text-white">{indice + 1} / {total}</p>
        </>
      )}
    </div>
  );
}
