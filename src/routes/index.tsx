import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { progressoDosEmpreendimentos, urlsDasFotos } from "@/lib/empreendimentos-store";
import type { Empreendimento } from "@/lib/empreendimentos";
import { gerencia } from "@/lib/fvs-db";
import { Etiqueta, Pagina, Progresso } from "@/components/modulos";
import { usePerfil } from "@/components/PerfilContext";
import { useEmpreendimentos } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CheckObra — Empreendimentos" },
      { name: "description", content: "Empreendimentos da sua empresa: OS, vistorias de entrega e FVS." },
      { property: "og:title", content: "CheckObra" },
      { property: "og:description", content: "Ordens de serviço, vistorias de entrega e FVS por empreendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inicio,
});

const STATUS: Record<Empreendimento["status"], { rotulo: string; tom: "ok" | "andamento" | "aberta" }> = {
  ativa: { rotulo: "Em obra", tom: "andamento" },
  pausada: { rotulo: "Pausado", tom: "aberta" },
  concluida: { rotulo: "Concluído", tom: "ok" },
};

function Inicio() {
  const perfil = usePerfil();
  const { lista, erro, recarregar } = useEmpreendimentos();
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [progresso, setProgresso] = useState<Awaited<ReturnType<typeof progressoDosEmpreendimentos>>>({});

  useEffect(() => {
    if (!lista?.length) return;
    urlsDasFotos(lista.map((e) => e.foto_path ?? "")).then(setFotos);
    progressoDosEmpreendimentos(lista.map((e) => e.id))
      .then(setProgresso)
      .catch(() => setProgresso({}));
  }, [lista]);

  return (
    <Pagina>
      <div className="relative z-10 -mt-7 space-y-4">
        {gerencia(perfil.papel) && (
          <Link to="/empreendimentos/novo" className="obra-btn w-full shadow-obra">
            <Plus className="h-5 w-5" aria-hidden /> Novo empreendimento
          </Link>
        )}
        {erro && (
          <div className="obra-card space-y-2 p-4">
            <p role="alert" className="obra-alerta-erro">Não foi possível carregar os empreendimentos.</p>
            <button type="button" className="obra-btn-claro w-full" onClick={() => void recarregar()}>Tentar de novo</button>
          </div>
        )}
        {lista === null ? (
          <p role="status" className="obra-card p-5 text-center text-obra-suave">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="obra-card px-6 py-10 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-obra-bege">
              <Building2 className="h-7 w-7 text-obra-laranja-texto" aria-hidden />
            </span>
            <p className="text-lg font-extrabold text-obra-grafite">Nenhum empreendimento ainda</p>
            <p className="mt-1 text-sm text-obra-suave">
              {gerencia(perfil.papel)
                ? "Crie o primeiro: o assistente monta torres, pavimentos e unidades para você."
                : "Nenhum empreendimento foi liberado para você. Peça ao admin da empresa."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {lista.map((e) => {
              const p = progresso[e.id];
              const st = STATUS[e.status];
              return (
                <li key={e.id}>
                  <Link to="/empreendimentos/$id" params={{ id: e.id }} className="obra-card block overflow-hidden transition active:scale-[0.99]">
                    {e.foto_path && fotos[e.foto_path] ? (
                      <img src={fotos[e.foto_path]} alt="" className="h-36 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-[repeating-linear-gradient(135deg,var(--obra-bege)_0_14px,var(--obra-fundo)_14px_28px)]" aria-hidden>
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-obra-card shadow-obra">
                          <Building2 className="h-7 w-7 text-obra-laranja-texto" />
                        </span>
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold text-obra-grafite">{e.nome}</p>
                          <p className="truncate text-sm text-obra-suave">{e.endereco || "Sem endereço"}</p>
                        </div>
                        <Etiqueta tom={st.tom}>{st.rotulo}</Etiqueta>
                      </div>
                      <Progresso valor={p?.pct ?? 0} />
                      <p className="text-xs text-obra-suave">
                        {p ? `${p.aprovadas} de ${p.total} unidades entregues` : "Calculando progresso…"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Pagina>
  );
}
