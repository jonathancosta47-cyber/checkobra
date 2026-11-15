import { createFileRoute, Link } from "@tanstack/react-router";
import { Building, ChevronRight, ClipboardList, Globe, HardHat, type LucideIcon } from "lucide-react";
import { Pagina } from "@/components/modulos";
import { SoGerencia, useSuperAdmin } from "@/components/AcessoConfig";

export const Route = createFileRoute("/configuracoes/")({
  head: () => ({ meta: [{ title: "Configurações — CheckObra" }] }),
  component: Page,
});

type Opcao = { to: "/configuracoes/empresa" | "/configuracoes/modelos" | "/configuracoes/empreiteiros" | "/configuracoes/padrao"; titulo: string; desc: string; Icone: LucideIcon };
const OPCOES: Opcao[] = [
  { to: "/configuracoes/modelos", titulo: "Modelos de FVS", desc: "Itens de verificação, critérios e versões", Icone: ClipboardList },
  { to: "/configuracoes/empreiteiros", titulo: "Empreiteiros", desc: "Quem executa os serviços da obra", Icone: HardHat },
  { to: "/configuracoes/empresa", titulo: "Empresa", desc: "Nome, dados e logos dos relatórios", Icone: Building },
];

function Page() {
  return (
    <Pagina>
      <div className="relative z-10 -mt-7">
        <SoGerencia>
          <Opcoes />
        </SoGerencia>
      </div>
    </Pagina>
  );
}

function Opcoes() {
  const superAdmin = useSuperAdmin();
  const lista = superAdmin
    ? [...OPCOES, { to: "/configuracoes/padrao" as const, titulo: "Modelos padrão (super admin)", desc: "Publicar modelos para todas as empresas", Icone: Globe }]
    : OPCOES;
  return (
    <ul className="obra-card divide-y divide-obra-borda overflow-hidden">
      {lista.map(({ to, titulo, desc, Icone }) => (
        <li key={to}>
          <Link to={to} className="flex min-h-18 items-center gap-3 px-4 py-4 transition hover:bg-obra-fundo">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-obra-laranja text-obra-grafite">
              <Icone className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold text-obra-grafite">{titulo}</span>
              <span className="block truncate text-sm text-obra-suave">{desc}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
