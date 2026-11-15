import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { loadOrders, statusLabel, type ServiceOrder } from "@/lib/orders";
import { importarOSDoAparelho, listarOS } from "@/lib/os-store";
import type { Empreendimento } from "@/lib/empreendimentos";
import { filtrarOS, progressoOS, type FiltroStatusOS } from "@/lib/modules";
import { BuscaCard, CardItem, Etiqueta, Pagina, Pilulas, Vazio, type Tom } from "@/components/modulos";
import { ComEmpreendimento } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/os/")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço — CheckObra" },
      { name: "description", content: "Ordens de serviço de manutenção com fotos, checklist e assinaturas." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina>
      <ComEmpreendimento>{(emp) => <ListaOS key={emp.id} emp={emp} />}</ComEmpreendimento>
    </Pagina>
  );
}

const TOM_STATUS: Record<ServiceOrder["status"], Tom> = { aberta: "aberta", em_andamento: "andamento", concluida: "ok" };
const FILTROS: { v: FiltroStatusOS; l: string }[] = [
  { v: "todas", l: "Todas" },
  { v: "aberta", l: "Abertas" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluida", l: "Fechadas" },
];
const CHAVE_IMPORTADAS = "checkobra:os-importadas";
const lerImportadas = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_IMPORTADAS) || "[]");
  } catch {
    return [];
  }
};

function ListaOS({ emp }: { emp: Empreendimento }) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<FiltroStatusOS>("todas");
  const [doAparelho, setDoAparelho] = useState<ServiceOrder[]>([]);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(() => {
    listarOS(emp.id)
      .then(setOrders)
      .catch(() => setErro("Não foi possível carregar as OS."))
      .finally(() => setCarregando(false));
  }, [emp.id]);
  useEffect(() => {
    carregar();
    const ja = new Set(lerImportadas());
    setDoAparelho(loadOrders().filter((o) => !ja.has(o.id)));
  }, [carregar]);
  const lista = filtrarOS(orders, { q, status });

  return (
    <>
      <BuscaCard label="Buscar OS" placeholder="Nº, cliente, equipamento ou endereço" value={q} onChange={setQ} />

      {doAparelho.length > 0 && (
        <section className="obra-card mt-4 space-y-3 border-l-4 border-obra-laranja p-4">
          <p className="text-sm text-obra-grafite">
            Há <strong>{doAparelho.length} {doAparelho.length === 1 ? "OS salva" : "OS salvas"}</strong> só neste aparelho. Importe para{" "}
            <strong>{emp.nome}</strong> para que fiquem guardadas na empresa.
          </p>
          <button
            type="button"
            className="obra-btn w-full"
            disabled={importando}
            onClick={async () => {
              setImportando(true);
              setErro("");
              try {
                const n = await importarOSDoAparelho(doAparelho, emp.id);
                try {
                  localStorage.setItem(CHAVE_IMPORTADAS, JSON.stringify([...lerImportadas(), ...doAparelho.map((o) => o.id)]));
                } catch {
                  /* sem armazenamento: o botão volta a aparecer, mas não duplica (o banco recusa o mesmo id) */
                }
                setDoAparelho([]);
                setAviso(`${n} ${n === 1 ? "OS importada" : "OS importadas"}. As do aparelho continuam guardadas como cópia.`);
                carregar();
              } catch {
                setErro("Não foi possível importar. Tente de novo.");
              } finally {
                setImportando(false);
              }
            }}
          >
            <Upload className="h-5 w-5" aria-hidden /> {importando ? "Importando…" : "Importar OS deste aparelho"}
          </button>
        </section>
      )}
      {aviso && <p role="status" className="obra-aviso mt-4">{aviso}</p>}

      <div className="mt-4">
        <Pilulas label="Filtrar por status" opcoes={FILTROS} valor={status} onChange={setStatus} />
      </div>
      {erro && <p role="alert" className="obra-alerta-erro mt-4">{erro}</p>}
      {carregando ? (
        <p role="status" className="mt-6 text-center text-obra-suave">Carregando…</p>
      ) : (
        <>
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
        </>
      )}
    </>
  );
}
