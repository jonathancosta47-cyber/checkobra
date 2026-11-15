import { describe, expect, it } from "vitest";
import { tituloDaRota } from "@/components/AppShell";

describe("título do cabeçalho", () => {
  it("mostra o nome da tela de acordo com a rota", () => {
    expect(tituloDaRota("/")).toBe("CheckObra");
    expect(tituloDaRota("/fvs")).toBe("Vistorias FVS");
    expect(tituloDaRota("/fvs/")).toBe("Vistorias FVS");
    expect(tituloDaRota("/fvs/nova")).toBe("Nova FVS");
    expect(tituloDaRota("/fvs/modelos")).toBe("Modelos de FVS");
    expect(tituloDaRota("/fvs/123")).toBe("Vistoria FVS");
    expect(tituloDaRota("/entregas")).toBe("Entregas");
    expect(tituloDaRota("/entregas/abc")).toBe("Entrega");
    expect(tituloDaRota("/ordem/abc")).toBe("Ordem de serviço");
    expect(tituloDaRota("/nova")).toBe("Nova OS");
    expect(tituloDaRota("/empresa")).toBe("Minha empresa");
  });
});
