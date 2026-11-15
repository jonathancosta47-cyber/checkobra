import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /entregas/$id → /vistorias/$id.
export const Route = createFileRoute("/entregas/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/vistorias/$id", params, replace: true });
  },
});
