import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getSession, isPublicPath, onSessionChange, type FieldSession } from "@/lib/field-auth";
import { AppShell } from "@/components/AppShell";

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
  return <AppShell session={session}>{children}</AppShell>;
}
