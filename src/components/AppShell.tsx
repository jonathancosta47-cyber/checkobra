import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Briefcase, Building2, ClipboardCheck, HardHat, Home, LogOut, Plus } from "lucide-react";
import { signOut, type FieldSession } from "@/lib/field-auth";

// Títulos do cabeçalho por rota (só apresentação; as rotas não mudam).
const TITULOS: [prefixo: string, titulo: string][] = [
  ["/fvs/modelos", "Modelos de FVS"],
  ["/fvs/nova", "Nova FVS"],
  ["/fvs/", "Vistoria FVS"],
  ["/fvs", "Vistorias FVS"],
  ["/entregas/nova", "Nova entrega"],
  ["/entregas/", "Entrega"],
  ["/entregas", "Entregas"],
  ["/empresa", "Minha empresa"],
  ["/empreiteiros", "Empreiteiros"],
  ["/nova", "Nova OS"],
  ["/ordem/", "Ordem de serviço"],
];
export function tituloDaRota(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const hit = TITULOS.find(([pre]) => (pre.endsWith("/") ? p.startsWith(pre) : p === pre || p.startsWith(pre + "/")));
  return hit?.[1] ?? "CheckObra";
}

// Moldura das páginas logadas: cabeçalho laranja + barra de navegação inferior.
// Nada disso aparece na impressão/PDF (no-print).
export function AppShell({ session, children }: { session: FieldSession; children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh bg-obra-fundo">
      <AppHeader title={tituloDaRota(pathname)} email={session.email} />
      <div className="obra-com-nav">{children}</div>
      <BottomNav pathname={pathname} />
    </div>
  );
}

function AppHeader({ title, email }: { title: string; email: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <header className="obra-cabecalho no-print sticky top-0 z-30 shadow-obra">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pb-4 pt-3">
        <Link to="/" className="obra-icone-btn" aria-label="Início">
          <HardHat className="h-6 w-6" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-extrabold leading-tight">{title}</h1>
          <p className="truncate text-xs font-semibold opacity-80" title={email}>
            {email}
          </p>
        </div>
        <button
          type="button"
          className="obra-icone-btn"
          aria-label={busy ? "Saindo…" : "Sair"}
          title="Sair"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            // ao sair, o AuthGate percebe e leva para /login
            await signOut().finally(() => setBusy(false));
          }}
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}

type Item = { to: "/" | "/fvs" | "/entregas" | "/empresa"; label: string; icon: typeof Home; ativo: (p: string) => boolean };
const ITENS: Item[] = [
  { to: "/", label: "Início", icon: Home, ativo: (p) => p === "/" || p === "/nova" || p.startsWith("/ordem/") },
  { to: "/fvs", label: "Vistorias", icon: ClipboardCheck, ativo: (p) => p.startsWith("/fvs") && !p.startsWith("/fvs/nova") },
  { to: "/entregas", label: "Entregas", icon: Building2, ativo: (p) => p.startsWith("/entregas") },
  { to: "/empresa", label: "Empresa", icon: Briefcase, ativo: (p) => p.startsWith("/empresa") || p.startsWith("/empreiteiros") },
];

function BottomNav({ pathname }: { pathname: string }) {
  const item = (i: Item) => {
    const ativo = i.ativo(pathname);
    const Icon = i.icon;
    return (
      <Link
        key={i.to}
        to={i.to}
        aria-current={ativo ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition ${ativo ? "text-obra-grafite" : "text-obra-suave"}`}
      >
        <span className={`flex h-8 w-12 items-center justify-center rounded-full ${ativo ? "bg-obra-bege" : ""}`}>
          <Icon className="h-5 w-5" aria-hidden strokeWidth={ativo ? 2.5 : 2} />
        </span>
        {i.label}
      </Link>
    );
  };
  const novaAtiva = pathname.startsWith("/fvs/nova");
  return (
    <nav
      aria-label="Navegação principal"
      className="no-print fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-obra-card shadow-[0_-8px_24px_-12px_oklch(0.235_0_0/0.25)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1.5" style={{ minHeight: "var(--obra-nav-altura)" }}>
        {ITENS.slice(0, 2).map(item)}
        <div className="flex flex-col items-center">
          <Link
            to="/fvs/nova"
            aria-label="Nova FVS"
            aria-current={novaAtiva ? "page" : undefined}
            className="-mt-9 flex h-16 w-16 items-center justify-center rounded-full bg-obra-laranja text-obra-grafite shadow-obra ring-4 ring-obra-fundo transition hover:bg-obra-laranja-forte active:scale-95"
          >
            <Plus className="h-8 w-8" strokeWidth={2.75} aria-hidden />
          </Link>
          <span className="mt-1 text-[11px] font-bold text-obra-grafite">Nova FVS</span>
        </div>
        {ITENS.slice(2).map(item)}
      </div>
    </nav>
  );
}
