import { createFileRoute, redirect } from "@tanstack/react-router";

// Os modelos de FVS agora ficam em Configurações (a tela de FVS só escolhe o modelo).
export const Route = createFileRoute("/fvs/modelos")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/modelos", replace: true });
  },
});
