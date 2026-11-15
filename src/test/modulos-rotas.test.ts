import { readFileSync } from "node:fs";
import path from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

// Só executa os redirecionamentos (beforeLoad), sem renderizar telas.
async function abrir(url: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  return router.state.location;
}

describe("endereços antigos redirecionam para os novos", () => {
  it.each([
    ["/nova", "/os/nova"],
    ["/ordem/abc", "/os/abc"],
    ["/entregas", "/vistorias"],
    ["/entregas/nova", "/vistorias/nova"],
    ["/entregas/xyz", "/vistorias/xyz"],
    ["/empreiteiros", "/configuracoes/empreiteiros"],
    ["/fvs/empreiteiros", "/configuracoes/empreiteiros"],
    ["/fvs/modelos", "/configuracoes/modelos"],
    ["/empresa", "/configuracoes/empresa"],
  ])("%s → %s", async (antigo, novo) => {
    expect((await abrir(antigo)).pathname.replace(/\/$/, "")).toBe(novo);
  });

  it("mantém o ?id= da edição", async () => {
    const loc = await abrir("/nova?id=7f3c2a10-1b2c-4d5e-8f90-123456789abc");
    expect(loc.pathname).toBe("/os/nova");
    expect(loc.search).toEqual({ id: "7f3c2a10-1b2c-4d5e-8f90-123456789abc" });
    expect((await abrir("/entregas/nova?id=abc-9")).search).toEqual({ id: "abc-9" });
  });

  it("o link antigo de redefinir senha continua abrindo a tela (sem redirecionar)", async () => {
    expect((await abrir("/entregas/senha#access_token=x")).pathname).toBe("/entregas/senha");
  });
});

describe("cada módulo só mostra o próprio conteúdo", () => {
  const ler = (f: string) => readFileSync(path.join(process.cwd(), "src", "routes", f), "utf8");
  const casos: [arquivo: string, proibidos: string[]][] = [
    ["os.index.tsx", ["/vistorias", "/fvs", "/entregas", "loadInspections", "listDeliveries"]],
    ["vistorias.index.tsx", ["/os", "/fvs", "loadOrders", "loadInspections"]],
    ["fvs.index.tsx", ["/os", "/vistorias", "/entregas", "Entrega de apartamentos", "loadOrders", "listDeliveries"]],
  ];
  it.each(casos)("%s não aponta nem carrega outros módulos", (arquivo, proibidos) => {
    const src = ler(arquivo);
    for (const p of proibidos) expect(src, `${arquivo} contém ${p}`).not.toContain(p);
  });

  it("as telas de FVS só escolhem modelo: nenhuma cria ou edita modelos", () => {
    for (const f of ["fvs.index.tsx", "fvs.nova.tsx", "fvs.$id.tsx"]) {
      expect(ler(f), f).not.toMatch(/salvarModelo|duplicarModelo|EditorModelo|\/configuracoes\/modelos|\/fvs\/modelos/);
    }
  });

  it("as listas não têm mais botão flutuante próprio de criar (o + central faz isso)", () => {
    for (const f of ["os.index.tsx", "vistorias.index.tsx", "fvs.index.tsx"]) {
      expect(ler(f)).not.toMatch(/fixed bottom|\+ Nova|Nova vistoria/);
    }
  });
});
