import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /empresa → /configuracoes.
export const Route = createFileRoute("/empresa")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes", replace: true });
  },
});
