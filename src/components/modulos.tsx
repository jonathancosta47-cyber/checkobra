// Peças visuais comuns às telas dos módulos (só apresentação).
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ClipboardCheck, Search, Wrench, type LucideIcon } from "lucide-react";
import type { Modulo } from "@/lib/modules";

export const ICONE_MODULO: Record<Modulo, LucideIcon> = {
  os: Wrench,
  vistorias: Building2,
  fvs: ClipboardCheck,
};

// Link para o relatório de um registro, no módulo certo.
export function LinkRegistro({ modulo, id, className, children }: { modulo: Modulo; id: string; className?: string; children: ReactNode }) {
  if (modulo === "os") return <Link to="/os/$id" params={{ id }} className={className}>{children}</Link>;
  if (modulo === "vistorias") return <Link to="/vistorias/$id" params={{ id }} className={className}>{children}</Link>;
  return <Link to="/fvs/$id" params={{ id }} className={className}>{children}</Link>;
}

// Campo de busca em cartão branco, sobreposto ao cabeçalho laranja.
export function BuscaCard({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="obra-card relative z-10 -mt-7 flex items-center gap-2 px-4">
      <Search className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
      <input
        type="search"
        aria-label={label}
        className="min-h-14 w-full bg-transparent text-base text-obra-grafite outline-none placeholder:text-obra-suave"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// Filtros em formato de pílula (rolagem horizontal no celular).
export function Pilulas<T extends string>({ opcoes, valor, onChange, label }: { opcoes: { v: T; l: string }[]; valor: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={valor === o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-12 shrink-0 rounded-full border px-4 text-sm font-bold transition ${
            valor === o.v ? "border-obra-laranja bg-obra-laranja text-obra-grafite" : "border-obra-borda bg-obra-card text-obra-suave"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// Seletor simples (obra, modelo...) no mesmo estilo.
export function SeletorFiltro({ label, valor, onChange, opcoes, todos }: { label: string; valor: string; onChange: (v: string) => void; opcoes: string[]; todos: string }) {
  if (!opcoes.length) return null;
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select className="field w-full text-sm font-semibold" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export type Tom = "ok" | "nc" | "andamento" | "aberta";
const TOM: Record<Tom, string> = {
  ok: "bg-obra-ok-fundo text-obra-ok",
  nc: "bg-obra-nc-fundo text-obra-nc",
  andamento: "bg-obra-info-fundo text-obra-info",
  aberta: "bg-obra-bege text-obra-laranja-texto",
};
export const Etiqueta = ({ tom, children }: { tom: Tom; children: ReactNode }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-extrabold ${TOM[tom]}`}>{children}</span>
);

export function Progresso({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-obra-bege" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
        <div className="h-full rounded-full bg-obra-laranja" style={{ width: `${v}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-extrabold text-obra-grafite">{v}%</span>
    </div>
  );
}

// Foto do registro, ou imagem padrão (ícone do módulo sobre fundo bege) quando não há foto.
export function FotoCapa({ src, modulo }: { src?: string | undefined; modulo: Modulo }) {
  const Icone = ICONE_MODULO[modulo];
  return src ? (
    <img src={src} alt="" className="h-32 w-full object-cover" loading="lazy" />
  ) : (
    <div className="flex h-32 w-full items-center justify-center bg-[repeating-linear-gradient(135deg,var(--obra-bege)_0_14px,var(--obra-fundo)_14px_28px)]" aria-hidden>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-obra-card shadow-obra">
        <Icone className="h-7 w-7 text-obra-laranja-texto" />
      </span>
    </div>
  );
}

// Card de item de um módulo: foto no topo, título, detalhe, etiqueta e progresso.
export function CardItem({ modulo, id, foto, numero, titulo, detalhe, etiqueta, progresso }: {
  modulo: Modulo; id: string; foto?: string | undefined; numero?: string | undefined; titulo: string; detalhe: string; etiqueta: ReactNode; progresso: number;
}) {
  return (
    <li>
      <LinkRegistro modulo={modulo} id={id} className="obra-card block overflow-hidden transition active:scale-[0.99]">
        <FotoCapa src={foto} modulo={modulo} />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {numero && <p className="text-xs font-extrabold text-obra-laranja-texto">{numero}</p>}
              <p className="truncate font-extrabold text-obra-grafite">{titulo}</p>
              <p className="truncate text-sm text-obra-suave">{detalhe}</p>
            </div>
            {etiqueta}
          </div>
          <Progresso valor={progresso} />
        </div>
      </LinkRegistro>
    </li>
  );
}

export function Vazio({ titulo, texto, modulo }: { titulo: string; texto: string; modulo: Modulo }) {
  const Icone = ICONE_MODULO[modulo];
  return (
    <div className="obra-card px-6 py-10 text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-obra-bege">
        <Icone className="h-7 w-7 text-obra-laranja-texto" aria-hidden />
      </span>
      <p className="text-lg font-extrabold text-obra-grafite">{titulo}</p>
      <p className="mt-1 text-sm text-obra-suave">{texto}</p>
    </div>
  );
}

// Conteúdo padrão das telas (largura confortável no celular e no computador).
export const Pagina = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <main className={`mx-auto w-full max-w-3xl px-4 pb-6 ${className}`}>{children}</main>
);
