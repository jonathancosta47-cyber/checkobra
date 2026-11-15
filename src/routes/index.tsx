import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { loadOrders, type ServiceOrder } from "@/lib/orders";
import { loadInspections, type FvsInspection } from "@/lib/fvs";
import { listDeliveries } from "@/lib/delivery-store";
import type { Delivery } from "@/lib/delivery";
import { atividadesRecentes, contarPendencias, MODULOS, registros, type Modulo } from "@/lib/modules";
import { Etiqueta, ICONE_MODULO, LinkRegistro, Pagina } from "@/components/modulos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CheckObra — Início" },
      { name: "description", content: "Ordens de serviço, vistorias de entrega e FVS da sua obra." },
      { property: "og:title", content: "CheckObra" },
      { property: "og:description", content: "Ordens de serviço, vistorias de entrega e FVS com fotos, assinaturas e PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inicio,
});

const TEXTO_PENDENCIA: Record<Modulo, (n: number) => string> = {
  os: (n) => (n === 1 ? "1 OS em aberto" : `${n} OS em aberto`),
  vistorias: (n) => (n === 1 ? "1 unidade com pendências" : `${n} unidades com pendências`),
  fvs: (n) => (n === 1 ? "1 ficha com NC" : `${n} fichas com NC`),
};

function Inicio() {
  const [os, setOs] = useState<ServiceOrder[]>([]);
  const [fvs, setFvs] = useState<FvsInspection[]>([]);
  const [vistorias, setVistorias] = useState<Delivery[] | null>(null); // null = carregando ou indisponível
  const [vistoriasErro, setVistoriasErro] = useState(false);

  useEffect(() => {
    setOs(loadOrders());
    setFvs(loadInspections());
    listDeliveries()
      .then(setVistorias)
      .catch(() => setVistoriasErro(true));
  }, []);

  const todos = registros(os, vistorias ?? [], fvs);
  const pend = contarPendencias(todos);
  const recentes = atividadesRecentes(todos, 5);

  return (
    <Pagina className="pt-5">
      <h2 className="sr-only">Módulos</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {(["os", "vistorias", "fvs"] as const).map((m) => {
          const Icone = ICONE_MODULO[m];
          const carregando = m === "vistorias" && vistorias === null;
          const n = pend[m];
          return (
            <li key={m}>
              <Link
                to={MODULOS[m].lista as "/os" | "/vistorias" | "/fvs"}
                className="obra-card flex min-h-28 items-center gap-4 p-5 transition active:scale-[0.99] sm:flex-col sm:items-start"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-obra-laranja text-obra-grafite">
                  <Icone className="h-7 w-7" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold leading-tight text-obra-grafite">{MODULOS[m].nome}</span>
                  <span className={`mt-1 block text-sm font-bold ${n ? "text-obra-nc" : "text-obra-suave"}`}>
                    {carregando ? (vistoriasErro ? "Não foi possível carregar" : "Carregando…") : n ? TEXTO_PENDENCIA[m](n) : "Nada pendente"}
                  </span>
                </span>
                <span
                  className={`flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-lg font-extrabold sm:self-end ${n ? "bg-obra-nc-fundo text-obra-nc" : "bg-obra-bege text-obra-grafite"}`}
                  aria-label={`${carregando ? "—" : n} pendências`}
                >
                  {carregando ? "—" : n}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-obra-grafite">Atividades recentes</h2>
          <Link to="/relatorios" className="obra-link">
            Ver relatórios
          </Link>
        </div>
        {recentes.length === 0 ? (
          <p className="obra-card p-5 text-center text-sm text-obra-suave">Nada registrado ainda. Toque no + para começar.</p>
        ) : (
          <ul className="obra-card divide-y divide-obra-borda overflow-hidden">
            {recentes.map((r) => {
              const Icone = ICONE_MODULO[r.modulo];
              return (
                <li key={`${r.modulo}-${r.id}`}>
                  <LinkRegistro modulo={r.modulo} id={r.id} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-obra-fundo">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-obra-bege">
                      <Icone className="h-5 w-5 text-obra-grafite" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-obra-grafite">{r.titulo}</span>
                      <span className="block truncate text-xs text-obra-suave">
                        {MODULOS[r.modulo].nomeCurto} · {new Date(r.data).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <Etiqueta tom={r.pendente ? "nc" : "ok"}>{r.situacao}</Etiqueta>
                    <ChevronRight className="h-4 w-4 shrink-0 text-obra-suave" aria-hidden />
                  </LinkRegistro>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Pagina>
  );
}
