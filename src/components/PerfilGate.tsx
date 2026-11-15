import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Building, MailOpen } from "lucide-react";
import { aceitarConvite, criarEmpresa, meuPerfil } from "@/lib/fvs-store";
import type { Perfil } from "@/lib/fvs-db";

const PerfilCtx = createContext<Perfil | null>(null);

// Perfil da pessoa logada (empresa e papel). Só use dentro de <PerfilGate>.
export function usePerfil(): Perfil {
  const p = useContext(PerfilCtx);
  if (!p) throw new Error("usePerfil fora do PerfilGate");
  return p;
}

// Garante que a conta pertence a uma empresa antes de mostrar as telas do FVS.
export function PerfilGate({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => {
    setErro("");
    meuPerfil()
      .then(setPerfil)
      .catch(() => {
        setErro("Não foi possível carregar sua empresa. Verifique a internet.");
        setPerfil(null);
      });
  }, []);
  useEffect(carregar, [carregar]);

  if (perfil === undefined) return <p role="status" className="py-10 text-center text-obra-suave">Carregando…</p>;
  if (erro)
    return (
      <div className="obra-card space-y-3 p-5 text-center">
        <p role="alert" className="obra-alerta-erro">{erro}</p>
        <button type="button" className="obra-btn w-full" onClick={carregar}>Tentar de novo</button>
      </div>
    );
  if (!perfil) return <SemEmpresa onPronto={carregar} />;
  return <PerfilCtx.Provider value={perfil}>{children}</PerfilCtx.Provider>;
}

const MENSAGENS: [trecho: string, texto: string][] = [
  ["Confirme seu e-mail", "Confirme seu e-mail pelo link que enviamos e tente de novo."],
  ["Nenhum convite", "Não há convite pendente para o seu e-mail. Peça ao admin da empresa para convidar você."],
  ["já pertence", "Sua conta já pertence a uma empresa. Recarregue a página."],
  ["Informe o nome", "Digite o nome da empresa."],
];
const traduzir = (msg: string) => MENSAGENS.find(([t]) => msg.includes(t))?.[1] ?? "Não foi possível concluir. Tente de novo.";

function SemEmpresa({ onPronto }: { onPronto: () => void }) {
  const [modo, setModo] = useState<"criar" | "convite">("criar");
  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  return (
    <section className="obra-card space-y-4 p-5">
      <div>
        <h2 className="text-xl font-extrabold text-obra-grafite">Sua conta ainda não tem empresa</h2>
        <p className="mt-1 text-sm text-obra-suave">
          As FVS ficam guardadas na empresa: cada empresa só vê os próprios dados.
        </p>
      </div>
      <div role="tablist" aria-label="Como entrar" className="obra-pilulas grid-cols-2">
        <button type="button" role="tab" aria-selected={modo === "criar"} className="obra-pilula" onClick={() => { setModo("criar"); setErro(""); }}>
          Criar empresa
        </button>
        <button type="button" role="tab" aria-selected={modo === "convite"} className="obra-pilula" onClick={() => { setModo("convite"); setErro(""); }}>
          Tenho convite
        </button>
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErro("");
          try {
            if (modo === "criar") await criarEmpresa(empresa, nome);
            else await aceitarConvite(nome);
            onPronto();
          } catch (err) {
            setErro(traduzir((err as Error).message));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="obra-label">Seu nome</span>
          <input className="obra-input" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        {modo === "criar" ? (
          <label className="block">
            <span className="obra-label">Nome da empresa</span>
            <input className="obra-input" required value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex.: Construtora Exemplo" />
            <span className="mt-1.5 block text-xs text-obra-suave">Você será o admin e poderá convidar sua equipe.</span>
          </label>
        ) : (
          <p className="obra-aviso">Vamos procurar um convite para o e-mail com que você entrou.</p>
        )}
        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
        <button type="submit" className="obra-btn w-full" disabled={busy}>
          {modo === "criar" ? <Building className="h-5 w-5" aria-hidden /> : <MailOpen className="h-5 w-5" aria-hidden />}
          {busy ? "Aguarde…" : modo === "criar" ? "Criar minha empresa" : "Aceitar convite"}
        </button>
      </form>
    </section>
  );
}
