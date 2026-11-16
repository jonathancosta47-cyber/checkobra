import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CampoFotos } from "@/components/CampoFotos";
import { compartilharArquivo, podeCompartilharArquivo } from "@/lib/pdf";

const foto = (id: string) => ({ id, src: `data:image/png;base64,${id}` });

describe("CampoFotos (Vistoria e FVS)", () => {
  it("adiciona pela galeria e avisa quando a foto é obrigatória", async () => {
    const onAdicionar = vi.fn(async () => undefined);
    render(<CampoFotos fotos={[]} onAdicionar={onAdicionar} onRemover={vi.fn()} exigida />);
    expect(screen.getByText("Foto obrigatória")).toBeInTheDocument();
    const galeria = screen.getByText("Galeria").parentElement!.querySelector("input")!;
    const arquivo = new File(["x"], "f.jpg", { type: "image/jpeg" });
    fireEvent.change(galeria, { target: { files: [arquivo] } });
    await waitFor(() => expect(onAdicionar).toHaveBeenCalledWith([arquivo]));
  });

  it("câmera usa a traseira do celular; ignora arquivos que não são imagem", async () => {
    const onAdicionar = vi.fn(async () => undefined);
    render(<CampoFotos fotos={[]} onAdicionar={onAdicionar} onRemover={vi.fn()} />);
    const camera = screen.getByText("Câmera").parentElement!.querySelector("input")!;
    expect(camera.getAttribute("capture")).toBe("environment");
    fireEvent.change(camera, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(onAdicionar).not.toHaveBeenCalled();
  });

  it("amplia, navega e remove", async () => {
    const onRemover = vi.fn();
    render(<CampoFotos fotos={[foto("a"), foto("b")]} onAdicionar={vi.fn()} onRemover={onRemover} />);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(screen.getByRole("dialog", { name: "Foto 1 de 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
    expect(screen.getByRole("dialog", { name: "Foto 2 de 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remover foto 2" }));
    expect(onRemover).toHaveBeenCalledWith("b");
  });

  it("somente leitura: sem botões de adicionar/remover", () => {
    render(<CampoFotos fotos={[foto("a")]} onAdicionar={vi.fn()} onRemover={vi.fn()} desabilitado />);
    expect(screen.queryByText("Câmera")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover foto 1" })).toBeNull();
  });
});

describe("Compartilhar PDF", () => {
  it("sem Web Share com arquivo (computador), baixa o PDF", async () => {
    expect(podeCompartilharArquivo()).toBe(false);
    const criar = vi.fn(() => "blob:teste");
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    expect(await compartilharArquivo(new Blob(["%PDF"], { type: "application/pdf" }), "FVS-0001.pdf", "FVS")).toBe("baixado");
    expect(clique).toHaveBeenCalled();
    clique.mockRestore();
  });

  it("no celular, usa o menu de compartilhar", async () => {
    const share = vi.fn(async () => undefined);
    Object.assign(navigator, { canShare: () => true, share });
    expect(await compartilharArquivo(new Blob(["%PDF"]), "FVS-0001.pdf", "FVS 1")).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "FVS 1" }));
    Object.assign(navigator, { canShare: undefined, share: undefined });
  });
});
