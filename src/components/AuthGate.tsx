import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { getSession, isPublicPath, onSessionChange, signOut, type FieldSession } from "@/lib/field-auth";

// A sessão do Supabase fica no navegador, então a checagem só acontece no cliente.
// Até lá, páginas protegidas não aparecem (evita mostrar conteúdo e depois redirecionar).
export function AuthGate({ children }: { children: ReactNode }) {
  const { pathname, href } = useLocation();
  const navigate = useNavigate();
  const isPublic = isPublicPath(pathname);
  // undefined = ainda verificando; null = sem login
  const [session, setSession] = useState<FieldSession | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getSession().then((s) => active && setSession(s));
    const stop = onSessionChange((s) => setSession(s));
    return () => {
      active = false;
      stop();
    };
  }, []);

  useEffect(() => {
    if (session === null && !isPublic) {
      navigate({ to: "/login", search: { redirect: href }, replace: true });
    }
  }, [session, isPublic, href, navigate]);

  if (isPublic) return <>{children}</>;
  if (!session) return null;
  return (
    <>
      <SessionBar session={session} />
      {children}
    </>
  );
}

// Barra fina no topo das páginas logadas: quem está conectado + botão Sair.
// Fica fora da impressão/PDF (no-print).
function SessionBar({ session }: { session: FieldSession }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="no-print border-b border-border/60 bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1.5 text-sm">
        <span className="min-w-0 truncate" title={session.email}>
          {session.email}
        </span>
        <button
          type="button"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold hover:bg-background/60 disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            // ao sair, o onSessionChange acima leva para /login
            await signOut().finally(() => setBusy(false));
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {busy ? "Saindo…" : "Sair"}
        </button>
      </div>
    </div>
  );
}
