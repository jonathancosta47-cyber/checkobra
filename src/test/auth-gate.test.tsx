import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "a@b.co" } } })),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
// Consultas ao banco: o perfil (com empresa) e a lista de empreendimentos (vazia).
const from = vi.hoisted(() => (tabela: string) => {
  const resultado =
    tabela === "perfis"
      ? { data: { id: "u1", nome: "Ana", papel: "admin_empresa", empresa_id: "emp", empresas: { nome: "Construtora Exemplo" } }, error: null }
      : { data: [], error: null };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) q[m] = () => q;
  q["maybeSingle"] = async () => resultado;
  q["then"] = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, from } }));

import { AuthGate } from "@/components/AuthGate";
import { isPublicPath } from "@/lib/field-auth";

function renderAt(path: string) {
  const root = createRootRoute({ component: () => <AuthGate><Outlet /></AuthGate> });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <p>Página inicial</p> });
  const login = createRoute({ getParentRoute: () => root, path: "/login", component: () => <p>Tela de login</p> });
  const router = createRouter({
    routeTree: root.addChildren([home, login]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("AuthGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends signed-out users to /login, remembering where they were going", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const router = renderAt("/");
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(screen.queryByText("Página inicial")).toBeNull();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({ redirect: "/" });
  });

  it("lets signed-in users through and shows who is signed in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "a@b.co" } } } });
    renderAt("/");
    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
    // o cabeçalho mostra a empresa da pessoa
    expect(await screen.findByText("Construtora Exemplo")).toBeInTheDocument();
  });

  it("Sair ends the Supabase session; the auth listener then sends the user to /login", async () => {
    let notify: (event: string, s: unknown) => void = () => {};
    auth.onAuthStateChange.mockImplementation(((cb: typeof notify) => {
      notify = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as never);
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "a@b.co" } } } });
    auth.signOut.mockImplementation(async () => {
      notify("SIGNED_OUT", null);
      return { error: null };
    });
    const router = renderAt("/");
    // espera a empresa carregar (cabeçalho completo) antes de tocar em Sair
    await screen.findByText("Construtora Exemplo");
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));
    expect(await screen.findByText("Tela de login", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalled();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("no session bar on public pages", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "a@b.co" } } } });
    renderAt("/login");
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sair/i })).toBeNull();
  });

  it("treats only login and password reset as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/entregas/senha")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/fvs")).toBe(false);
  });
});
