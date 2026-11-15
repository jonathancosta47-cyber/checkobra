import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Building2, ClipboardCheck, FileBarChart, Home, LogOut, Plus, Settings, Wrench, X, type LucideIcon } from "lucide-react";
import { signOut, type FieldSession } from "@/lib/field-auth";
import { destinoDoMais, moduloDaRota, MODULOS } from "@/lib/modules";
import { ICONE_MODULO } from "@/components/modulos";

// Títulos do cabeçalho por rota (só apresentação).
const TITULOS: [prefixo: string, titulo: string][] = [
  ["/os/nova", "Ordem de serviço"],
  ["/os/", "Ordem de serviço"],
  ["/os", "Ordens de Serviço"],
  ["/vistorias/nova", "Vistoria de entrega"],
  ["/vistorias/", "Vistoria de entrega"],
  ["/vistorias", "Vistorias de entrega"],
  ["/fvs/modelos", "Modelos de FVS"],
  ["/fvs/empreiteiros", "Empreiteiros"],
  ["/fvs/nova", "Ficha FVS"],
  ["/fvs/", "Ficha FVS"],
  ["/fvs", "FVS"],
  ["/relatorios", "Relatórios"],
  ["/configuracoes", "Configurações"],
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
    <header className="obra-cabecalho no-print relative z-0">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pb-10 pt-3">
        <Link to="/configuracoes" className="obra-icone-btn" aria-label="Configurações da empresa" title="Configurações">
          <Settings className="h-5 w-5" aria-hidden />
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

type Item = { to: "/" | "/os" | "/vistorias" | "/fvs" | "/relatorios"; label: string; icon: LucideIcon };
const ESQUERDA: Item[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/os", label: "OS", icon: Wrench },
];
const DIREITA: Item[] = [
  { to: "/vistorias", label: "Vistorias", icon: Building2 },
  { to: "/fvs", label: "FVS", icon: ClipboardCheck },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
];
const estaEm = (pathname: string, to: Item["to"]) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));

function BottomNav({ pathname: bruto }: { pathname: string }) {
  const pathname = bruto.replace(/\/+$/, "") || "/";
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const destino = destinoDoMais(pathname);
  useEffect(() => setMenu(false), [pathname]);

  const item = (i: Item) => {
    const ativo = estaEm(pathname, i.to);
    const Icon = i.icon;
    return (
      <Link
        key={i.to}
        to={i.to}
        aria-current={ativo ? "page" : undefined}
        className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition ${ativo ? "text-obra-grafite" : "text-obra-suave"}`}
      >
        <span className={`flex h-8 w-11 items-center justify-center rounded-full ${ativo ? "bg-obra-bege" : ""}`}>
          <Icon className="h-5 w-5" aria-hidden strokeWidth={ativo ? 2.5 : 2} />
        </span>
        <span className="max-w-full truncate">{i.label}</span>
      </Link>
    );
  };

  const modulo = moduloDaRota(pathname);
  const rotuloMais = modulo ? MODULOS[modulo].novoRotulo : "Novo";

  return (
    <>
      {menu && <MenuNovo onClose={() => setMenu(false)} />}
      <nav
        aria-label="Navegação principal"
        className="no-print fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-obra-card shadow-[0_-8px_24px_-12px_oklch(0.235_0_0/0.25)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-6 items-end px-1 pt-1.5 pb-1.5" style={{ minHeight: "var(--obra-nav-altura)" }}>
          {ESQUERDA.map(item)}
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label={destino ? rotuloMais : "Criar novo: escolher módulo"}
              aria-haspopup={destino ? undefined : "dialog"}
              aria-expanded={destino ? undefined : menu}
              onClick={() => (destino ? navigate({ to: destino as "/os/nova" | "/vistorias/nova" | "/fvs/nova" }) : setMenu((v) => !v))}
              className="-mt-9 flex h-16 w-16 items-center justify-center rounded-full bg-obra-laranja text-obra-grafite shadow-obra ring-4 ring-obra-fundo transition hover:bg-obra-laranja-forte active:scale-95"
            >
              {menu ? <X className="h-8 w-8" strokeWidth={2.75} aria-hidden /> : <Plus className="h-8 w-8" strokeWidth={2.75} aria-hidden />}
            </button>
            <span className="mt-1 max-w-full truncate text-[11px] font-bold text-obra-grafite">{rotuloMais}</span>
          </div>
          {DIREITA.map(item)}
        </div>
      </nav>
    </>
  );
}

// Menu do "+" na Início e em Relatórios: escolher o que criar.
function MenuNovo({ onClose }: { onClose: () => void }) {
  const primeiro = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    primeiro.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const opcoes = [
    { m: "os" as const, to: "/os/nova" as const, desc: "Manutenção com cliente, fotos e assinaturas" },
    { m: "vistorias" as const, to: "/vistorias/nova" as const, desc: "Entrega de unidade: cômodos e pendências" },
    { m: "fvs" as const, to: "/fvs/nova" as const, desc: "Ficha de verificação de serviço da obra" },
  ];
  return (
    <div className="no-print fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="O que você quer criar?">
      <button type="button" className="absolute inset-0 bg-obra-grafite/40" aria-label="Fechar menu" onClick={onClose} />
      <div
        className="absolute inset-x-0 mx-auto max-w-lg px-3"
        style={{ bottom: "calc(var(--obra-nav-altura) + env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <ul className="obra-card space-y-1 p-2">
          {opcoes.map((o, k) => {
            const Icone = ICONE_MODULO[o.m];
            return (
              <li key={o.m}>
                <Link
                  ref={k === 0 ? primeiro : undefined}
                  to={o.to}
                  onClick={onClose}
                  className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-obra-fundo focus:bg-obra-fundo"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obra-laranja text-obra-grafite">
                    <Icone className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-extrabold text-obra-grafite">{MODULOS[o.m].novoRotulo}</span>
                    <span className="block truncate text-xs text-obra-suave">{o.desc}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
