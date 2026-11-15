import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /empreiteiros → /fvs/empreiteiros.
export const Route = createFileRoute("/empreiteiros")({
  beforeLoad: () => {
    throw redirect({ to: "/fvs/empreiteiros", replace: true });
  },
});
