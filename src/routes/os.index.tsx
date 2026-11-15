import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadOrders, statusLabel, type ServiceOrder } from "@/lib/orders";
import { filtrarOS, progressoOS, type FiltroStatusOS } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, Vazio, type Tom } from "@/components/modulos";

export const Route = createFileRoute("/os/")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço — CheckObra" },
      { name: "description", content: "Ordens de serviço de manutenção com fotos, checklist e assinaturas." },
    ],
  }),
  component: ListaOS,
});

const TOM_STATUS: Record<ServiceOrder["status"], Tom> = { aberta: "aberta", em_andamento: "andamento", concluida: "ok" };
const FILTROS: { v: FiltroStatusOS; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "aberta", l: "Abertas" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluida", l: "Fechadas" },
];

function ListaOS() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<FiltroStatusOS>("todas");
  useEffect(() => setOrders(loadOrders()), []);
  const lista = filtrarOS(orders, { q, status });

  return (
    <Pagina>
      <BuscaCard label="Buscar OS" placeholder="Nº, cliente, equipamento ou endereço" value={q} onChange={setQ} />
      <div className="mt-4">
        <Pilulas label="Filtrar por status" opcoes={FILTROS} valor={status} onChange={setStatus} />
      </div>
      <p className="mb-3 mt-4 text-sm font-bold text-obra-suave">
        {lista.length} de {orders.length} ordens
      </p>
      {lista.length === 0 ? (
        <Vazio
          modulo="os"
          titulo={orders.length ? "Nenhuma OS com esses filtros" : "Nenhuma ordem ainda"}
          texto={orders.length ? "Limpe a busca ou escolha outro status." : "Toque no + para criar a primeira."}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {lista.map((o) => (
            <CardItem
              key={o.id}
              modulo="os"
              id={o.id}
              foto={o.photos[0]}
              numero={`OS #${String(o.number).padStart(4, "0")} · ${new Date(o.createdAt).toLocaleDateString("pt-BR")}`}
              titulo={o.client.name || "Sem cliente"}
              detalhe={o.equipment || o.client.address || "—"}
              etiqueta={<Etiqueta tom={TOM_STATUS[o.status]}>{statusLabel[o.status]}</Etiqueta>}
              progresso={progressoOS(o)}
            />
          ))}
        </ul>
      )}
    </Pagina>
  );
}
