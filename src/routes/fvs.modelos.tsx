import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listarModelos } from "@/lib/fvs-store";
import type { Modelo } from "@/lib/fvs-db";
import { Etiqueta, Pagina } from "@/components/modulos";
import { PerfilGate } from "@/components/PerfilGate";

export const Route = createFileRoute("/fvs/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de FVS — CheckObra" },
      { name: "description", content: "Modelos de ficha de verificação de serviço da empresa." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina className="pt-5">
      <PerfilGate>
        <Modelos />
      </PerfilGate>
    </Pagina>
  );
}

function Modelos() {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    listarModelos()
      .then(setModelos)
      .catch(() => setErro("Não foi possível carregar os modelos."));
  }, []);

  if (erro) return <p role="alert" className="obra-alerta-erro">{erro}</p>;
  if (!modelos) return <p role="status" className="py-10 text-center text-obra-suave">Carregando…</p>;
  return (
    <div className="space-y-4">
      <p className="obra-aviso">Modelos da sua empresa. Criar e editar modelos chega na próxima etapa.</p>
      {modelos.length === 0 ? (
        <p className="obra-card p-5 text-center text-sm text-obra-suave">Nenhum modelo cadastrado.</p>
      ) : (
        modelos.map((m) => (
          <section key={m.id} className="obra-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-obra-grafite">{m.nome}</h2>
                {m.descricao && <p className="text-sm text-obra-suave">{m.descricao}</p>}
              </div>
              <Etiqueta tom={m.ativo ? "ok" : "aberta"}>{m.ativo ? "Ativo" : "Inativo"}</Etiqueta>
            </div>
            <ol className="divide-y divide-obra-borda">
              {m.itens.map((i, k) => (
                <li key={i.id} className="py-2 text-sm">
                  <p className="font-bold text-obra-grafite">
                    <span className="text-obra-suave">{k + 1}.</span> {i.texto}
                  </p>
                  {i.criterio && <p className="text-obra-suave">Critério: {i.criterio}</p>}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
