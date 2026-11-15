import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DeliveryForm } from "@/components/DeliveryForm";
import { newDelivery, type Delivery } from "@/lib/delivery";
import { readDeliveryComVinculo, type VinculoVistoria } from "@/lib/delivery-store";
import { listarLocais } from "@/lib/empreendimentos-store";
import { caminhoDoLocal, type Empreendimento, type Local } from "@/lib/empreendimentos";
import { SeletorLocal } from "@/components/SeletorLocal";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/vistorias/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" ? { id: s["id"] } : {},
  head: () => ({
    meta: [
      { title: "Preencher vistoria de entrega — CheckObra" },
      { name: "description", content: "Checklist por ambiente, documentação e assinaturas da entrega." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useSearch();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="mb-5 text-3xl font-bold">{id ? "Editar vistoria" : "Nova vistoria de entrega"}</h1>
      {id ? <Editar id={id} /> : <ComEmpreendimento>{(emp) => <Nova key={emp.id} emp={emp} />}</ComEmpreendimento>}
    </main>
  );
}

// Editar: a vistoria já sabe o seu empreendimento e local.
function Editar({ id }: { id: string }) {
  const [estado, setEstado] = useState<{ delivery: Delivery; vinculo: VinculoVistoria } | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    readDeliveryComVinculo(id)
      .then(setEstado)
      .catch(() => setErro("Vistoria não encontrada ou acesso indisponível."));
  }, [id]);
  if (erro) return <p role="alert" className="obra-alerta-erro">{erro}</p>;
  if (!estado) return <p role="status">Carregando…</p>;
  return <DeliveryForm key={estado.delivery.id} initial={estado.delivery} vinculo={estado.vinculo} />;
}

// Nova: primeiro escolhe a unidade na estrutura; a identificação já vem preenchida.
function Nova({ emp }: { emp: Empreendimento }) {
  const [locais, setLocais] = useState<Local[] | null>(null);
  const [inicio, setInicio] = useState<{ delivery: Delivery; vinculo: VinculoVistoria } | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    listarLocais([emp.id])
      .then(setLocais)
      .catch(() => setErro("Não foi possível carregar a estrutura do empreendimento."));
  }, [emp.id]);

  if (erro) return <p role="alert" className="obra-alerta-erro">{erro}</p>;
  if (!locais) return <p role="status">Carregando…</p>;
  if (inicio) return <DeliveryForm key={inicio.delivery.id} initial={inicio.delivery} vinculo={inicio.vinculo} />;

  return (
    <section aria-label="Escolha a unidade" className="space-y-3">
      <p className="text-lg font-extrabold text-obra-grafite">Qual unidade será vistoriada?</p>
      <SeletorLocal
        locais={locais}
        aceita={["unidade", "area_comum"]}
        onEscolher={(l) => {
          const caminho = caminhoDoLocal(locais, l.id);
          const de = (t: Local["tipo"]) => caminho.find((c) => c.tipo === t)?.nome ?? "";
          const d = newDelivery();
          d.unit = {
            ...d.unit,
            development: emp.nome,
            tower: de("torre"),
            floor: de("pavimento").replace(/º pavimento$/, ""),
            apartment: l.nome,
          };
          setInicio({ delivery: d, vinculo: { empreendimentoId: emp.id, localId: l.id } });
        }}
      />
    </section>
  );
}
