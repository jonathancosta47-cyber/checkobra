import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, HardHat, LogOut, MailCheck } from "lucide-react";
import {
  getSession,
  MIN_PASSWORD,
  requestPasswordReset,
  signIn,
  signInErrorMessage,
  signOut,
  signUp,
  type FieldSession,
  type SignInError,
} from "@/lib/field-auth";

// Só aceita caminhos internos ("/algo"), nunca "//site" ou URLs externas.
const safeRedirect = (v: unknown) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — CheckObra" },
      { name: "description", content: "Acesse ou crie sua conta no CheckObra." },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

const nameErrors: SignInError[] = ["missing_name"];
const emailErrors: SignInError[] = ["invalid_email", "wrong_credentials", "already_registered"];
const passwordErrors: SignInError[] = ["missing_password", "wrong_credentials", "short_password", "weak_password"];

function LoginPage() {
  const navigate = useNavigate();
  const target = safeRedirect(Route.useSearch().redirect);
  const goOn = () => navigate({ href: target, replace: true });
  const [session, setSession] = useState<FieldSession | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sentTo, setSentTo] = useState(""); // e-mail que recebeu o link de confirmação

  useEffect(() => {
    let active = true;
    getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice("");
  };

  if (!ready) return null;
  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="eyebrow">CheckObra</p>
          <p className="text-sm text-muted-foreground">Vistorias de campo</p>
        </div>
      </div>

      {session ? (
        <section className="panel space-y-4" aria-live="polite">
          <h1 className="font-display text-2xl font-bold">Olá, {session.name.split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">Você entrou como {session.email}.</p>
          <button type="button" className="btn-primary h-12 w-full" onClick={goOn}>
            Continuar
          </button>
          <button
            type="button"
            className="btn-ghost h-12 w-full justify-center gap-2"
            onClick={async () => {
              await signOut();
              setSession(null);
              setPassword("");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </section>
      ) : sentTo ? (
        <section className="panel space-y-4" aria-live="polite">
          <MailCheck className="h-10 w-10 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold">Confira seu e-mail</h1>
          <p className="text-sm">
            Se <strong>{sentTo}</strong> ainda não tiver conta, enviamos um link de confirmação para ele.
            Abra o link e depois entre com sua senha.
          </p>
          <p className="text-sm text-muted-foreground">Não chegou? Veja a caixa de spam.</p>
          <button
            type="button"
            className="btn-primary h-12 w-full"
            onClick={() => {
              setSentTo("");
              setPassword("");
              switchMode("signin");
            }}
          >
            Voltar para entrar
          </button>
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Acesso" className="mb-6 grid grid-cols-2 rounded-full bg-secondary p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`h-11 rounded-full text-sm font-bold transition ${mode === m ? "bg-primary text-primary-foreground" : "text-secondary-foreground"}`}
                onClick={() => switchMode(m)}
              >
                {m === "signin" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <h1 className="mb-1 font-display text-3xl font-bold">{isSignup ? "Criar conta" : "Entrar"}</h1>
          <p className="mb-6 text-muted-foreground">
            {isSignup ? "Preencha seus dados para começar." : "Use seu e-mail e senha."}
          </p>
          <form
            noValidate
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              setNotice("");
              if (isSignup) {
                const r = await signUp(name, email, password);
                setBusy(false);
                if ("error" in r) setError(r.error);
                else if ("confirmEmail" in r) setSentTo(email.trim());
                else goOn();
              } else {
                const r = await signIn(email, password);
                setBusy(false);
                if ("error" in r) setError(r.error);
                else goOn();
              }
            }}
          >
            {isSignup && (
              <label className="block">
                <span className="text-sm font-semibold">Nome</span>
                <input
                  className="field mt-1 h-12"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!error && nameErrors.includes(error)}
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-semibold">E-mail</span>
              <input
                className="field mt-1 h-12"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error && emailErrors.includes(error)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Senha</span>
              <div className="relative mt-1">
                <input
                  className="field h-12 pr-12"
                  type={show ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error && passwordErrors.includes(error)}
                  aria-describedby={isSignup ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {isSignup && (
                <span id="password-hint" className="mt-1 block text-xs text-muted-foreground">
                  Mínimo de {MIN_PASSWORD} caracteres.
                </span>
              )}
            </label>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {signInErrorMessage[error]}
              </p>
            )}
            <button type="submit" className="btn-primary h-12 w-full" disabled={busy}>
              {busy ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
            </button>
          </form>

          {!isSignup && (
            <button
              type="button"
              className="mt-4 self-center p-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              onClick={async () => {
                setError(null);
                const ok = await requestPasswordReset(email);
                if (ok) setNotice("Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
                else setError("invalid_email");
              }}
            >
              Esqueci minha senha
            </button>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
              {notice}
            </p>
          )}
        </>
      )}
    </main>
  );
}
