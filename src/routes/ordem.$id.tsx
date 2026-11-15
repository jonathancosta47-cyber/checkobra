import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: /ordem/$id → /os/$id.
export const Route = createFileRoute("/ordem/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/os/$id", params, replace: true });
  },
});
