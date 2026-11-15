import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /entregas/ → /vistorias.
export const Route = createFileRoute("/entregas/")({
  beforeLoad: () => {
    throw redirect({ to: "/vistorias", replace: true });
  },
});
