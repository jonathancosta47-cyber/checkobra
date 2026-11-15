import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const down = (e: React.PointerEvent) => {
    const c = ref.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const c = ref.current;
    if (c) onChange(c.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        className="h-44 w-full touch-none rounded-md border-2 border-dashed border-border bg-card text-foreground"
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Assine com o dedo ou mouse</span>
        <Button variant="link" type="button" onClick={clear} className="h-auto p-0 text-xs font-semibold text-obra-laranja-texto">
          Limpar
        </Button>
      </div>
    </div>
  );
}
