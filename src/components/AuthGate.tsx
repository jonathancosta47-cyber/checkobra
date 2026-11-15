import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getSession, isPublicPath, onSessionChange } from "@/lib/field-auth";

// A sessão do Supabase fica no navegador, então a checagem só acontece no cliente.
// Até lá, páginas protegidas não aparecem (evita mostrar conteúdo e depois redirecionar).
export function AuthGate({ children }: { children: ReactNode }) {
  const { pathname, href } = useLocation();
  const navigate = useNavigate();
  const isPublic = isPublicPath(pathname);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getSession().then((s) => active && setSignedIn(!!s));
    const stop = onSessionChange((s) => setSignedIn(!!s));
    return () => {
      active = false;
      stop();
    };
  }, []);

  useEffect(() => {
    if (signedIn === false && !isPublic) {
      navigate({ to: "/login", search: { redirect: href }, replace: true });
    }
  }, [signedIn, isPublic, href, navigate]);

  return isPublic || signedIn ? <>{children}</> : null;
}
