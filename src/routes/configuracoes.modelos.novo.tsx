import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pagina } from "@/components/modulos";
import { EditorModelo, useServicosSugeridos } from "@/components/EditorModelo";
import { SoGerencia, SoSuperAdmin } from "@/components/AcessoConfig";

export const Route = createFileRoute("/configuracoes/modelos/novo")({
  // ?padrao=1: modelo padrão do sistema (só super admin)
  validateSearch: (s: Record<string, unknown>): { padrao?: boolean } => (s["padrao"] === 1 || s["padrao"] === "1" || s["padrao"] === true ? { padrao: true } : {}),
  head: () => ({ meta: [{ title: "Novo modelo de FVS — CheckObra" }] }),
  component: Page,
});

function Page() {
  const { padrao } = Route.useSearch();
  const navigate = useNavigate();
  const servicos = useServicosSugeridos();
  const editor = (
    <EditorModelo
      inicial={null}
      padrao={!!padrao}
      servicosSugeridos={servicos}
      onSalvo={() => navigate({ to: padrao ? "/configuracoes/padrao" : "/configuracoes/modelos", replace: true })}
    />
  );
  return (
    <Pagina>
      <div className="relative z-10 -mt-7">
        <SoGerencia>{padrao ? <SoSuperAdmin>{editor}</SoSuperAdmin> : editor}</SoGerencia>
      </div>
    </Pagina>
  );
}
