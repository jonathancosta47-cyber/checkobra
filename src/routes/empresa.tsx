import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /empresa → /configuracoes/empresa.
export const Route = createFileRoute("/empresa")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/empresa", replace: true });
  },
});
