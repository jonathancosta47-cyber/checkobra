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
  // ?id= edita uma vistoria; ?local= começa uma nova já na unidade escolhida (vindo do painel)
  validateSearch: (s: Record<string, unknown>): { id?: string; local?: string } => ({
    ...(typeof s["id"] === "string" ? { id: s["id"] } : {}),
    ...(typeof s["local"] === "string" ? { local: s["local"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Preencher vistoria de entrega — CheckObra" },
      { name: "description", content: "Checklist por ambiente, documentação e assinaturas da entrega." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id, local } = Route.useSearch();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="mb-5 text-3xl font-bold">{id ? "Editar vistoria" : "Nova vistoria de entrega"}</h1>
      {id ? <Editar id={id} /> : <ComEmpreendimento>{(emp) => <Nova key={emp.id} emp={emp} localInicial={local} />}</ComEmpreendimento>}
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
function Nova({ emp, localInicial }: { emp: Empreendimento; localInicial?: string | undefined }) {
  const [locais, setLocais] = useState<Local[] | null>(null);
  const [inicio, setInicio] = useState<{ delivery: Delivery; vinculo: VinculoVistoria } | null>(null);
  const [erro, setErro] = useState("");
  // começa a vistoria na unidade escolhida, com a identificação já preenchida
  const iniciar = (ls: Local[], l: Local) => {
    const caminho = caminhoDoLocal(ls, l.id);
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
  };
  useEffect(() => {
    listarLocais([emp.id])
      .then((ls) => {
        setLocais(ls);
        // vindo do painel (?local=): já abre o formulário daquela unidade
        const escolhido = localInicial ? ls.find((l) => l.id === localInicial && (l.tipo === "unidade" || l.tipo === "area_comum")) : undefined;
        if (escolhido) iniciar(ls, escolhido);
      })
      .catch(() => setErro("Não foi possível carregar a estrutura do empreendimento."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.id, localInicial]);

  if (erro) return <p role="alert" className="obra-alerta-erro">{erro}</p>;
  if (!locais) return <p role="status">Carregando…</p>;
  if (inicio) return <DeliveryForm key={inicio.delivery.id} initial={inicio.delivery} vinculo={inicio.vinculo} />;

  return (
    <section aria-label="Escolha a unidade" className="space-y-3">
      <p className="text-lg font-extrabold text-obra-grafite">Qual unidade será vistoriada?</p>
      <SeletorLocal
        locais={locais}
        aceita={["unidade", "area_comum"]}
        onEscolher={(l) => iniciar(locais, l)}
      />
    </section>
  );
}
