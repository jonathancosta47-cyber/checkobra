import { createFileRoute, redirect } from "@tanstack/react-router";

// O cadastro de empreiteiros agora fica em Configurações.
export const Route = createFileRoute("/fvs/empreiteiros")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/empreiteiros", replace: true });
  },
});
