import { describe, expect, it } from "vitest";
import { tituloDaRota } from "@/components/AppShell";

describe("título do cabeçalho", () => {
  it("mostra o nome da tela de acordo com a rota", () => {
    expect(tituloDaRota("/")).toBe("Empreendimentos");
    expect(tituloDaRota("/empreendimentos/novo")).toBe("Novo empreendimento");
    expect(tituloDaRota("/empreendimentos/abc")).toBe("Empreendimento");
    expect(tituloDaRota("/empreendimentos/abc/estrutura")).toBe("Estrutura");
    expect(tituloDaRota("/os")).toBe("Ordens de Serviço");
    expect(tituloDaRota("/os/")).toBe("Ordens de Serviço");
    expect(tituloDaRota("/os/nova")).toBe("Ordem de serviço");
    expect(tituloDaRota("/os/abc")).toBe("Ordem de serviço");
    expect(tituloDaRota("/vistorias")).toBe("Vistorias de entrega");
    expect(tituloDaRota("/vistorias/abc")).toBe("Vistoria de entrega");
    expect(tituloDaRota("/fvs")).toBe("FVS");
    expect(tituloDaRota("/fvs/nova")).toBe("Ficha FVS");
    expect(tituloDaRota("/fvs/123")).toBe("Ficha FVS");
    expect(tituloDaRota("/configuracoes/modelos")).toBe("Modelos de FVS");
    expect(tituloDaRota("/configuracoes/modelos/novo")).toBe("Novo modelo de FVS");
    expect(tituloDaRota("/configuracoes/modelos/abc")).toBe("Modelo de FVS");
    expect(tituloDaRota("/configuracoes/empreiteiros")).toBe("Empreiteiros");
    expect(tituloDaRota("/configuracoes/empresa")).toBe("Empresa");
    expect(tituloDaRota("/configuracoes/padrao")).toBe("Modelos padrão");
    expect(tituloDaRota("/relatorios")).toBe("Relatórios");
    expect(tituloDaRota("/configuracoes")).toBe("Configurações");
  });
});
