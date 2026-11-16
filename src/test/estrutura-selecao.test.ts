import { describe, expect, it, vi } from "vitest";

// Supabase simulado para a exclusão em lote: registra quantos ids vão em cada requisição.
const lotes = vi.hoisted(() => [] as number[]);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      let ids: string[] = [];
      q["delete"] = () => q;
      q["in"] = (_c: string, v: string[]) => {
        ids = v;
        lotes.push(v.length);
        return q;
      };
      q["select"] = () => q;
      q["then"] = (ok: (v: unknown) => unknown) => Promise.resolve({ data: ids.map((id) => ({ id })), error: null }).then(ok);
      return q;
    },
  },
}));

import { alternarGrupo, estadoSelecao, unidadesDentro, type Local } from "@/lib/empreendimentos";
import { removerLocais } from "@/lib/empreendimentos-store";

const loc = (id: string, tipo: Local["tipo"], pai_id: string | null): Local => ({ id, empreendimento_id: "e", pai_id, tipo, nome: id, ordem: 0 });
const locais = [
  loc("t", "torre", null),
  loc("p1", "pavimento", "t"),
  loc("p2", "pavimento", "t"),
  loc("101", "unidade", "p1"),
  loc("102", "unidade", "p1"),
  loc("201", "unidade", "p2"),
  loc("hall", "area_comum", "p1"),
];

describe("seleção de várias unidades", () => {
  it("unidades dentro de um pavimento ou de uma torre (sem áreas comuns)", () => {
    expect(unidadesDentro(locais, "p1").map((l) => l.id).sort()).toEqual(["101", "102"]);
    expect(unidadesDentro(locais, "t").map((l) => l.id).sort()).toEqual(["101", "102", "201"]);
  });

  it("estado da caixa: todas, algumas ou nenhuma", () => {
    expect(estadoSelecao(["101", "102"], new Set())).toBe("nenhuma");
    expect(estadoSelecao(["101", "102"], new Set(["101"]))).toBe("algumas");
    expect(estadoSelecao(["101", "102"], new Set(["101", "102", "201"]))).toBe("todas");
    expect(estadoSelecao([], new Set(["101"]))).toBe("nenhuma");
  });

  it("selecionar todas marca o que falta; com todas marcadas, desmarca o grupo e mantém o resto", () => {
    const parcial = alternarGrupo(["101", "102"], new Set(["101", "201"]));
    expect([...parcial].sort()).toEqual(["101", "102", "201"]);
    const desmarcado = alternarGrupo(["101", "102"], parcial);
    expect([...desmarcado]).toEqual(["201"]);
  });
});

describe("exclusão em lote", () => {
  it("envia em blocos de 100 e soma o que o banco apagou", async () => {
    lotes.length = 0;
    const ids = Array.from({ length: 230 }, (_, i) => `u${i}`);
    expect(await removerLocais(ids)).toBe(230);
    expect(lotes).toEqual([100, 100, 30]);
  });
});
