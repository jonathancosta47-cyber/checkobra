import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /empreiteiros → /configuracoes/empreiteiros.
export const Route = createFileRoute("/empreiteiros")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/empreiteiros", replace: true });
  },
});
