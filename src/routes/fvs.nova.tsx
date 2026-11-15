import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { criarInspecao, listarModelos } from "@/lib/fvs-store";
import { listarLocais } from "@/lib/empreendimentos-store";
import { caminhoDoLocal, nomeDoCaminho, type Empreendimento, type Local } from "@/lib/empreendimentos";
import type { Modelo } from "@/lib/fvs-db";
import { ehPadrao, modelosParaFvs } from "@/lib/configuracoes";
import { Pagina } from "@/components/modulos";
import { SeletorLocal } from "@/components/SeletorLocal";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/fvs/nova")({
  head: () => ({
    meta: [
      { title: "Nova FVS — CheckObra" },
      { name: "description", content: "Escolha o local e o modelo da ficha de verificação." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina className="pt-5">
      <ComEmpreendimento>{(emp) => <NovaFvs key={emp.id} emp={emp} />}</ComEmpreendimento>
    </Pagina>
  );
}

function NovaFvs({ emp }: { emp: Empreendimento }) {
  const navigate = useNavigate();
  const [locais, setLocais] = useState<Local[] | null>(null);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [local, setLocal] = useState<Local | null>(null);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    Promise.all([listarLocais([emp.id]), listarModelos()])
      .then(([l, m]) => {
        setLocais(l);
        // só modelos ativos, na versão atual (da empresa primeiro, depois os padrão)
        setModelos(modelosParaFvs(m).filter((x) => x.itens.length));
      })
      .catch(() => setErro("Não foi possível carregar locais e modelos."));
  }, [emp.id]);

  const comecar = async (m: Modelo) => {
    if (!local) return;
    setCriando(true);
    setErro("");
    try {
      const id = await criarInspecao(emp.id, local.id, m);
      navigate({ to: "/fvs/$id", params: { id }, replace: true });
    } catch {
      setErro("Não foi possível criar a FVS. Tente de novo.");
      setCriando(false);
    }
  };

  const passo = local ? 2 : 1;
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-2 gap-2" aria-label="Passos">
        {["Local", "Modelo"].map((l, k) => (
          <li
            key={l}
            aria-current={passo === k + 1 ? "step" : undefined}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold ${passo === k + 1 ? "bg-obra-laranja text-obra-grafite" : passo > k + 1 ? "bg-obra-bege text-obra-grafite" : "bg-obra-card text-obra-suave"}`}
          >
            {passo > k + 1 ? <Check className="h-4 w-4" aria-hidden /> : <span aria-hidden>{k + 1}.</span>} {l}
          </li>
        ))}
      </ol>

      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {!local ? (
        <section aria-label="Escolha o local">
          <h2 className="mb-3 text-lg font-extrabold text-obra-grafite">Onde é a verificação?</h2>
          {locais === null ? <p role="status" className="text-obra-suave">Carregando…</p> : <SeletorLocal locais={locais} onEscolher={setLocal} />}
        </section>
      ) : (
        <section aria-label="Escolha o modelo" className="space-y-3">
          <div className="obra-card flex items-center gap-3 p-3">
            <button type="button" onClick={() => setLocal(null)} className="obra-icone-btn bg-obra-bege" aria-label="Trocar o local">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0 text-sm">
              <p className="truncate font-extrabold text-obra-grafite">{emp.nome}</p>
              <p className="truncate text-obra-suave">{nomeDoCaminho(caminhoDoLocal(locais ?? [], local.id))}</p>
            </div>
          </div>
          <h2 className="text-lg font-extrabold text-obra-grafite">Qual serviço vai verificar?</h2>
          {modelos.length === 0 ? (
            <p className="obra-card p-5 text-sm text-obra-suave">Nenhum modelo de FVS ativo. O admin ou um engenheiro cadastra em Configurações › Modelos de FVS.</p>
          ) : (
            <ul className="space-y-3">
              {modelos.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={criando}
                    onClick={() => void comecar(m)}
                    className="obra-card flex min-h-16 w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] disabled:opacity-60"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obra-bege text-obra-grafite">
                      <ClipboardList className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold text-obra-grafite">{m.nome}</span>
                      <span className="block truncate text-sm text-obra-suave">
                        {m.itens.length} itens · v{m.versao}
                        {m.servico ? ` · ${m.servico}` : ""}
                      </span>
                    </span>
                    {ehPadrao(m) && <span className="shrink-0 rounded-full bg-obra-bege px-2 py-0.5 text-xs font-extrabold text-obra-grafite">Padrão</span>}
                    <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {criando && <p role="status" className="text-center text-obra-suave">Criando a FVS…</p>}
        </section>
      )}
    </div>
  );
}
