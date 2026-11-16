import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase simulado: registra a ordem das chamadas para provar que os arquivos saem antes do registro.
const ordem = vi.hoisted(() => [] as string[]);
const apagou = vi.hoisted(() => ({ linhas: 1 }));
vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {};
    let acao = "select";
    q["select"] = () => q;
    q["eq"] = () => q;
    q["delete"] = () => {
      acao = "delete";
      return q;
    };
    q["maybeSingle"] = async () => ({ data: { pdf_path: "e/emp/fvs/1-FVS.pdf" }, error: null });
    q["then"] = (ok: (v: unknown) => unknown) => {
      if (acao === "delete") ordem.push(`apagar ${tabela}`);
      const data = acao === "delete" ? Array.from({ length: apagou.linhas }, () => ({ id: "fvs" })) : [{ storage_path: "e/emp/fvs/a.jpg" }];
      return Promise.resolve({ data, error: null }).then(ok);
    };
    return q;
  };
  return {
    supabase: {
      from: consulta,
      storage: {
        from: (bucket: string) => ({
          remove: async (caminhos: string[]) => {
            ordem.push(`remover ${bucket}: ${caminhos.join(",")}`);
            return { error: null };
          },
        }),
      },
    },
  };
});

import { excluirInspecao } from "@/lib/fvs-store";

describe("excluirInspecao", () => {
  beforeEach(() => {
    ordem.length = 0;
    apagou.linhas = 1;
  });

  it("remove fotos e PDF do Storage antes de apagar a FVS", async () => {
    expect(await excluirInspecao("fvs")).toBe(true);
    expect(ordem).toEqual(["remover fvs-fotos: e/emp/fvs/a.jpg", "remover fvs-pdfs: e/emp/fvs/1-FVS.pdf", "apagar inspecoes"]);
  });

  it("retorna false quando o banco recusa (sem permissão)", async () => {
    apagou.linhas = 0;
    expect(await excluirInspecao("fvs")).toBe(false);
  });
});
