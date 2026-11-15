import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { duplicarModelo, lerModelo } from "@/lib/configuracoes-store";
import { ehPadrao, type ModeloResumo } from "@/lib/configuracoes";
import { Pagina } from "@/components/modulos";
import { EditorModelo, useServicosSugeridos } from "@/components/EditorModelo";
import { SoGerencia, useSuperAdmin } from "@/components/AcessoConfig";

export const Route = createFileRoute("/configuracoes/modelos/$id")({
  head: () => ({ meta: [{ title: "Editar modelo de FVS — CheckObra" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return (
    <Pagina>
      <div className="relative z-10 -mt-7">
        <SoGerencia>
          <Editar key={id} id={id} />
        </SoGerencia>
      </div>
    </Pagina>
  );
}

function Editar({ id }: { id: string }) {
  const navigate = useNavigate();
  const superAdmin = useSuperAdmin();
  const servicos = useServicosSugeridos();
  const [modelo, setModelo] = useState<ModeloResumo | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  useEffect(() => {
    lerModelo(id)
      .then(setModelo)
      .catch(() => setErro("Não foi possível carregar o modelo."));
  }, [id]);

  if (modelo === undefined || superAdmin === null) return <p role="status" className="obra-card p-5 text-center text-obra-suave">{erro || "Carregando…"}</p>;
  if (!modelo) return <p className="obra-card p-5 text-center text-obra-suave">Modelo não encontrado.</p>;
  if (!modelo.atual) return <p className="obra-card p-5 text-center text-obra-suave">Esta é uma versão antiga do modelo (v{modelo.versao}); edite a versão atual.</p>;

  // Modelo padrão: só o super admin edita; os demais só leem e podem duplicar.
  if (ehPadrao(modelo) && !superAdmin) {
    return (
      <div className="space-y-4">
        <section className="obra-card space-y-2 p-4">
          <h2 className="text-lg font-extrabold text-obra-grafite">{modelo.nome}</h2>
          <p className="text-sm text-obra-suave">Modelo padrão do sistema (somente leitura) · v{modelo.versao}</p>
          <ol className="divide-y divide-obra-borda">
            {modelo.itens.map((i, k) => (
              <li key={i.id ?? k} className="py-2 text-sm">
                <p className="font-bold text-obra-grafite">{k + 1}. {i.texto}</p>
                {i.criterio && <p className="text-obra-suave">Critério: {i.criterio}</p>}
              </li>
            ))}
          </ol>
        </section>
        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
        <button
          type="button"
          className="obra-btn w-full"
          onClick={async () => {
            try {
              const novo = await duplicarModelo(modelo.id);
              navigate({ to: "/configuracoes/modelos/$id", params: { id: novo }, replace: true });
            } catch {
              setErro("Não foi possível duplicar.");
            }
          }}
        >
          <Copy className="h-5 w-5" aria-hidden /> Duplicar para minha empresa
        </button>
      </div>
    );
  }

  return (
    <EditorModelo
      inicial={modelo}
      padrao={ehPadrao(modelo)}
      servicosSugeridos={servicos}
      onSalvo={() => navigate({ to: ehPadrao(modelo) ? "/configuracoes/padrao" : "/configuracoes/modelos", replace: true })}
    />
  );
}
