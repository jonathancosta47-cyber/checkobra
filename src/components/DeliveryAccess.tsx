import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
export function DeliveryAccess({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false),
    [signed, setSigned] = useState(false),
    [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSigned(!!data.session);
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSigned(!!session);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (!ready)
    return (
      <p role="status" className="py-12 text-center">
        Carregando…
      </p>
    );
  // O botão Sair fica na barra do topo (AuthGate), comum a todas as páginas.
  if (signed)
    return (
      <>
        {children}
      </>
    );
  return (
    <section className="mx-auto max-w-sm space-y-4 py-8">
      <h2 className="text-2xl font-bold">
        {mode === "signup"
          ? "Criar conta"
          : mode === "reset"
            ? "Recuperar senha"
            : "Entrar no CheckObra"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Suas entregas de apartamentos ficam vinculadas à sua conta.
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const form = new FormData(e.currentTarget),
            email = String(form.get("email")),
            password = String(form.get("password") || "");
          try {
            const { data, error } =
              mode === "reset"
                ? await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/redefinir-senha",
                  })
                : mode === "signup"
                  ? await supabase.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: window.location.href },
                    })
                  : await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (mode === "reset") setMessage("Confira seu e-mail para redefinir a senha.");
            else if (mode === "signup" && !("session" in data && data.session))
              setMessage("Confira seu e-mail para confirmar a conta e depois entre.");
          } catch {
            setMessage("Não foi possível concluir. Confira os dados e tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          E-mail
          <input className="field mt-1" type="email" name="email" required autoComplete="email" />
        </label>
        {mode !== "reset" && (
          <label className="block text-sm">
            Senha
            <input
              className="field mt-1"
              type="password"
              name="password"
              minLength={8}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        <Button className="w-full" disabled={busy}>
          {busy
            ? "Aguarde…"
            : mode === "signup"
              ? "Criar conta"
              : mode === "reset"
                ? "Enviar link"
                : "Entrar"}
        </Button>
      </form>
      {mode === "login" && (
        <>
          <Button
            variant="outline"
            className="google-signin w-full"
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin + "/vistorias" },
              });
              if (error) setMessage("Não foi possível entrar com Google.");
            }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continuar com Google
          </Button>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="link"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </Button>
        {mode === "login" && (
          <Button variant="link" onClick={() => setMode("reset")}>
            Esqueci minha senha
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
