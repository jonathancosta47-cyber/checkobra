import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { getSession, mapAuthError, signIn, signUp, toFieldSession } from "@/lib/field-auth";

const session = (meta: Record<string, unknown> = {}) =>
  ({ user: { id: "u1", email: "ana@horizonte.com", user_metadata: meta } }) as never;

describe("field auth (Supabase)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in with Supabase and returns the user", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: session({ name: "Ana Ribeiro" }) }, error: null });
    const r = await signIn(" ana@horizonte.com ", "obra1234");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ana@horizonte.com", password: "obra1234" });
    expect(r).toEqual({ session: { userId: "u1", email: "ana@horizonte.com", name: "Ana Ribeiro" } });
  });

  it("validates input before calling Supabase", async () => {
    expect(await signIn("ana", "x")).toEqual({ error: "invalid_email" });
    expect(await signIn("ana@horizonte.com", "")).toEqual({ error: "missing_password" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("maps Supabase errors to screen messages", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials", status: 400 } });
    expect(await signIn("ana@horizonte.com", "errada")).toEqual({ error: "wrong_credentials" });
    expect(mapAuthError({ code: "email_not_confirmed", status: 400 })).toBe("email_not_confirmed");
    expect(mapAuthError({ status: 0 })).toBe("unavailable");
    auth.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await signIn("ana@horizonte.com", "obra1234")).toEqual({ error: "unavailable" });
  });

  it("reads the current session and falls back to the e-mail as name", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() } });
    expect((await getSession())?.name).toBe("ana");
    expect(toFieldSession(null)).toBeNull();
  });

  it("signs up with name and asks to confirm the e-mail when there is no session", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "u2" } }, error: null });
    expect(await signUp(" Ana Ribeiro ", "ana@horizonte.com", "obra12345")).toEqual({ confirmEmail: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "ana@horizonte.com",
      password: "obra12345",
      options: { data: { name: "Ana Ribeiro" }, emailRedirectTo: window.location.origin + "/login" },
    });
  });

  it("enters right away when Supabase does not require confirmation", async () => {
    auth.signUp.mockResolvedValue({ data: { session: session({ name: "Ana" }) }, error: null });
    expect(await signUp("Ana", "ana@horizonte.com", "obra12345")).toEqual({
      session: { userId: "u1", email: "ana@horizonte.com", name: "Ana" },
    });
  });

  it("validates sign-up input and maps sign-up errors", async () => {
    expect(await signUp(" ", "ana@horizonte.com", "obra12345")).toEqual({ error: "missing_name" });
    expect(await signUp("Ana", "ana", "obra12345")).toEqual({ error: "invalid_email" });
    expect(await signUp("Ana", "ana@horizonte.com", "curta")).toEqual({ error: "short_password" });
    expect(auth.signUp).not.toHaveBeenCalled();
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { code: "weak_password", status: 422 } });
    expect(await signUp("Ana", "ana@horizonte.com", "12345678")).toEqual({ error: "weak_password" });
    expect(mapAuthError({ code: "user_already_exists", status: 422 }, "signup")).toBe("already_registered");
    expect(mapAuthError({ code: "over_email_send_rate_limit", status: 429 }, "signup")).toBe("rate_limited");
    expect(mapAuthError({ status: 400 }, "signup")).toBe("unavailable");
  });
});
