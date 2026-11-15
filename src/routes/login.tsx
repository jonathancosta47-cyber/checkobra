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
    <main className="min-h-dvh bg-obra-fundo text-obra-grafite">
      {/* Cabeçalho laranja curvo com a marca */}
      <header className="obra-cabecalho px-4 pb-20 text-center">
        <div className="pt-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-obra-grafite shadow-obra">
            <HardHat className="h-8 w-8 text-obra-laranja" aria-hidden />
          </span>
          <p className="mt-3 text-3xl font-extrabold tracking-tight">CheckObra</p>
          <p className="text-sm font-semibold opacity-80">Vistorias de qualidade em obra</p>
        </div>
      </header>

      <div className="mx-auto -mt-12 w-full max-w-md px-4 pb-10">
        {session ? (
          <section className="obra-card space-y-4 p-5" aria-live="polite">
            <h1 className="text-2xl font-extrabold">Olá, {session.name.split(" ")[0]}!</h1>
            <p className="text-sm text-obra-suave">Você entrou como {session.email}.</p>
            <button type="button" className="obra-btn w-full" onClick={goOn}>
              Continuar
            </button>
            <button
              type="button"
              className="obra-btn-claro w-full"
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
          <section className="obra-card space-y-4 p-5" aria-live="polite">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-obra-bege">
              <MailCheck className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="text-2xl font-extrabold">Confira seu e-mail</h1>
            <p className="text-sm">
              Se <strong>{sentTo}</strong> ainda não tiver conta, enviamos um link de confirmação para ele.
              Abra o link e depois entre com sua senha.
            </p>
            <p className="text-sm text-obra-suave">Não chegou? Veja a caixa de spam.</p>
            <button
              type="button"
              className="obra-btn w-full"
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
          <section className="obra-card p-5">
            <div role="tablist" aria-label="Acesso" className="obra-pilulas mb-5 grid-cols-2">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className="obra-pilula"
                  onClick={() => switchMode(m)}
                >
                  {m === "signin" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>

            <h1 className="text-2xl font-extrabold">{isSignup ? "Criar conta" : "Bem-vindo de volta"}</h1>
            <p className="mb-5 text-sm text-obra-suave">
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
                  <span className="obra-label">Nome</span>
                  <input
                    className="obra-input"
                    type="text"
                    autoComplete="name"
                    autoCapitalize="words"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!error && nameErrors.includes(error)}
                  />
                </label>
              )}
              <label className="block">
                <span className="obra-label">E-mail</span>
                <input
                  className="obra-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error && emailErrors.includes(error)}
                />
              </label>
              <label className="block">
                <span className="obra-label">Senha</span>
                <div className="relative">
                  <input
                    className="obra-input pr-14"
                    type={show ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!error && passwordErrors.includes(error)}
                    aria-describedby={isSignup ? "password-hint" : undefined}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-2xl text-obra-suave"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {isSignup && (
                  <span id="password-hint" className="mt-1.5 block text-xs text-obra-suave">
                    Mínimo de {MIN_PASSWORD} caracteres.
                  </span>
                )}
              </label>
              {error && (
                <p role="alert" className="obra-alerta-erro">
                  {signInErrorMessage[error]}
                </p>
              )}
              <button type="submit" className="obra-btn w-full" disabled={busy}>
                {busy ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
              </button>
            </form>

            {!isSignup && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  className="obra-link"
                  onClick={async () => {
                    setError(null);
                    const ok = await requestPasswordReset(email);
                    if (ok) setNotice("Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
                    else setError("invalid_email");
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
            {notice && (
              <p role="status" className="obra-aviso mt-3">
                {notice}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
