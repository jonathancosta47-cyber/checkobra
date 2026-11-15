// Login do app, via Supabase Auth (e-mail e senha).
// A sessão é guardada pelo próprio Supabase no navegador e renovada automaticamente.
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Páginas que abrem sem login.
export const PUBLIC_PATHS = ["/login", "/redefinir-senha", "/entregas/senha"];
export const isPublicPath = (path: string) => PUBLIC_PATHS.includes(path.replace(/\/+$/, "") || "/");

export interface FieldSession {
  userId: string;
  name: string;
  email: string;
}

export type SignInError =
  | "invalid_email"
  | "missing_password"
  | "wrong_credentials"
  | "email_not_confirmed"
  | "missing_name"
  | "short_password"
  | "weak_password"
  | "already_registered"
  | "signup_disabled"
  | "rate_limited"
  | "unavailable";

export const MIN_PASSWORD = 8;

export const signInErrorMessage: Record<SignInError, string> = {
  invalid_email: "Digite um e-mail válido.",
  missing_password: "Digite sua senha.",
  wrong_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  missing_name: "Digite seu nome.",
  short_password: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
  weak_password: "Senha muito fraca. Misture letras, números e símbolos.",
  already_registered: "Este e-mail já tem conta. Entre ou use “Esqueci minha senha”.",
  signup_disabled: "O cadastro de novas contas está desativado.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  unavailable: "Não foi possível conectar. Verifique a internet e tente novamente.",
};

export function validateCredentials(email: string, password: string): SignInError | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "invalid_email";
  if (!password) return "missing_password";
  return null;
}

export function toFieldSession(s: Session | null): FieldSession | null {
  if (!s) return null;
  const email = s.user.email ?? "";
  const meta = s.user.user_metadata as { name?: unknown; full_name?: unknown } | undefined;
  const name = [meta?.name, meta?.full_name].find((v): v is string => typeof v === "string" && !!v.trim());
  return { userId: s.user.id, email, name: name ?? email.split("@")[0] ?? email };
}

// Traduz os erros do Supabase Auth para mensagens da tela.
export function mapAuthError(
  error: { code?: string | undefined; status?: number | undefined },
  context: "signin" | "signup" = "signin",
): SignInError {
  if (error.code === "email_not_confirmed") return "email_not_confirmed";
  if (error.code === "weak_password") return "weak_password";
  if (error.code === "user_already_exists" || error.code === "email_exists") return "already_registered";
  if (error.code === "signup_disabled" || error.code === "email_provider_disabled") return "signup_disabled";
  if (error.status === 429 || error.code?.startsWith("over_")) return "rate_limited";
  if (error.code === "email_address_invalid") return "invalid_email";
  if (error.code === "invalid_credentials") return "wrong_credentials";
  if (context === "signin" && error.status === 400) return "wrong_credentials";
  return "unavailable";
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ session: FieldSession } | { error: SignInError }> {
  const invalid = validateCredentials(email, password);
  if (invalid) return { error: invalid };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: mapAuthError(error) };
    const session = toFieldSession(data.session);
    return session ? { session } : { error: "unavailable" };
  } catch {
    return { error: "unavailable" };
  }
}

export function validateSignUp(name: string, email: string, password: string): SignInError | null {
  if (!name.trim()) return "missing_name";
  const invalid = validateCredentials(email, password);
  if (invalid) return invalid;
  if (password.length < MIN_PASSWORD) return "short_password";
  return null;
}

// Cria a conta. Se o Supabase exigir confirmação de e-mail (padrão), não há sessão ainda:
// a pessoa recebe um link e entra depois. Por segurança o Supabase responde igual quando o
// e-mail já existe, então a tela mostra a mesma mensagem nos dois casos.
export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ session: FieldSession } | { confirmEmail: true } | { error: SignInError }> {
  const invalid = validateSignUp(name, email, password);
  if (invalid) return { error: invalid };
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    if (error) return { error: mapAuthError(error, "signup") };
    const session = toFieldSession(data.session);
    return session ? { session } : { confirmEmail: true };
  } catch {
    return { error: "unavailable" };
  }
}

export async function getSession(): Promise<FieldSession | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return toFieldSession(data.session);
  } catch {
    return null;
  }
}

// Avisa quando a pessoa entra ou sai (inclusive em outra aba). Retorna a função para parar de ouvir.
export function onSessionChange(cb: (s: FieldSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, s) => cb(toFieldSession(s)));
  return () => data.subscription.unsubscribe();
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<boolean> {
  if (validateCredentials(email, "x")) return false;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin + "/redefinir-senha",
  });
  return !error;
}
