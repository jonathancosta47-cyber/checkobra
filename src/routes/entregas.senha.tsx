import { createFileRoute } from "@tanstack/react-router";
import { RedefinirSenhaPage } from "./redefinir-senha";

// Endereço antigo dos e-mails de recuperação já enviados. Mostra a mesma tela sem
// redirecionar, para não perder o código de acesso que vem no endereço.
export const Route = createFileRoute("/entregas/senha")({
  head: () => ({ meta: [{ title: "Redefinir senha — CheckObra" }] }),
  component: RedefinirSenhaPage,
});
