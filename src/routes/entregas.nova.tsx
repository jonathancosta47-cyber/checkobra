import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /entregas/nova → /vistorias/nova (mantém ?id= da edição).
export const Route = createFileRoute("/entregas/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/vistorias/nova", search, replace: true });
  },
});
