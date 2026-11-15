import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { definirModeloAtivo, listarModelosAtuais } from "@/lib/configuracoes-store";
import { ehPadrao, ordenarModelos, type ModeloResumo } from "@/lib/configuracoes";
import { Etiqueta, Pagina } from "@/components/modulos";
import { SoGerencia, SoSuperAdmin } from "@/components/AcessoConfig";

// Área do super admin: publicar e manter os modelos padrão, visíveis a todas as empresas.
export const Route = createFileRoute("/configuracoes/padrao")({
  head: () => ({ meta: [{ title: "Modelos padrão — CheckObra" }] }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <div className="relative z-10 -mt-7">
        <SoGerencia>
          <SoSuperAdmin>
            <Padrao />
          </SoSuperAdmin>
        </SoGerencia>
      </div>
    </Pagina>
  );
}

function Padrao() {
  const [modelos, setModelos] = useState<ModeloResumo[] | null>(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => {
    listarModelosAtuais()
      .then((ms) => setModelos(ordenarModelos(ms.filter(ehPadrao))))
      .catch(() => setErro("Não foi possível carregar os modelos padrão."));
  }, []);
  useEffect(carregar, [carregar]);

  return (
    <div className="space-y-4">
      <p className="obra-aviso">Estes modelos aparecem para todas as empresas (somente leitura para elas).</p>
      <Link to="/configuracoes/modelos/novo" search={{ padrao: true }} className="obra-btn w-full">
        <Plus className="h-5 w-5" aria-hidden /> Publicar modelo padrão
      </Link>
      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
      {!modelos ? (
        <p role="status" className="text-center text-obra-suave">Carregando…</p>
      ) : (
        <ul className="space-y-3">
          {modelos.map((m) => (
            <li key={m.id} className="obra-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-obra-grafite">{m.nome}</p>
                  <p className="text-sm text-obra-suave">{m.servico || "Sem serviço"} · {m.itens.length} itens · v{m.versao}</p>
                </div>
                <Etiqueta tom={m.ativo ? "ok" : "aberta"}>{m.ativo ? "Publicado" : "Desativado"}</Etiqueta>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/configuracoes/modelos/$id" params={{ id: m.id }} className="obra-btn-claro text-sm">
                  <Pencil className="h-4 w-4" aria-hidden /> Editar
                </Link>
                <button
                  type="button"
                  className="obra-btn-claro text-sm"
                  onClick={async () => {
                    const ok = await definirModeloAtivo(m.id, !m.ativo).catch(() => false);
                    if (ok) setModelos((ms) => (ms ?? []).map((x) => (x.id === m.id ? { ...x, ativo: !m.ativo } : x)));
                    else setErro("Não foi possível alterar.");
                  }}
                >
                  <Power className="h-4 w-4" aria-hidden /> {m.ativo ? "Desativar" : "Publicar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
