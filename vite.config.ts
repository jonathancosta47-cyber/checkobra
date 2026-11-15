import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Build independente: o Nitro gera um servidor Node em .output/ por padrão
// e detecta sozinho Vercel/Netlify/Cloudflare quando o build roda nessas plataformas.
export default defineConfig(({ command }) => ({
  // strictPort: se a 8080 estiver ocupada (outro servidor esquecido), falha em vez de
  // abrir em silêncio na 8081 com outra configuração.
  server: { host: "::", port: 8080, strictPort: true },
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts envolve o servidor do Start com a página de erro amigável.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
