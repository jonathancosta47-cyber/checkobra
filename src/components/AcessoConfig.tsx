import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { gerencia } from "@/lib/fvs-db";
import { souSuperAdmin } from "@/lib/configuracoes-store";
import { usePerfil } from "@/components/PerfilContext";

const SemAcesso = ({ texto }: { texto: string }) => (
  <div className="obra-card flex items-center gap-3 p-5 text-obra-grafite">
    <Lock className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
    <p className="text-sm">{texto}</p>
  </div>
);

// Configurações: só admin da empresa e engenheiro (o banco também confere).
export function SoGerencia({ children }: { children: ReactNode }) {
  const perfil = usePerfil();
  if (!gerencia(perfil.papel)) return <SemAcesso texto="As configurações são acessadas pelo admin da empresa ou por um engenheiro." />;
  return <>{children}</>;
}

// Diz se a pessoa é super admin (para mostrar a área de modelos padrão).
export function useSuperAdmin() {
  const [sim, setSim] = useState<boolean | null>(null);
  useEffect(() => {
    souSuperAdmin().then(setSim);
  }, []);
  return sim;
}

export function SoSuperAdmin({ children }: { children: ReactNode }) {
  const sim = useSuperAdmin();
  if (sim === null) return <p role="status" className="py-10 text-center text-obra-suave">Carregando…</p>;
  if (!sim) return <SemAcesso texto="Só o super admin do CheckObra publica modelos padrão." />;
  return <>{children}</>;
}
