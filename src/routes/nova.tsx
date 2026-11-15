import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /nova → /os/nova (mantém ?id= da edição).
export const Route = createFileRoute("/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/os/nova", search, replace: true });
  },
});
