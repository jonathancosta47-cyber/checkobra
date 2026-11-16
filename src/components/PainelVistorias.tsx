import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Circle, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { Delivery } from "@/lib/delivery";
import type { Local } from "@/lib/empreendimentos";
import { montarPainel, pct, ROTULO_CURTO, ROTULO_SITUACAO, SITUACOES, type CelulaUnidade, type Situacao } from "@/lib/painel-vistorias";
import { Pilulas } from "@/components/modulos";

// Cores de situação (significado fixo) — sempre com ícone e rótulo, nunca só a cor.
const ESTILO: Record<Situacao, { celula: string; barra: string; icone: string; Icone: LucideIcon }> = {
  aprovada: { celula: "bg-obra-ok-fundo border-t-4 border-obra-ok", barra: "bg-obra-ok", icone: "text-obra-ok", Icone: CheckCircle2 },
  ressalvas: { celula: "bg-obra-bege border-t-4 border-obra-laranja", barra: "bg-obra-laranja", icone: "text-obra-laranja-texto", Icone: AlertTriangle },
  pendente: { celula: "bg-obra-nc-fundo border-t-4 border-obra-nc", barra: "bg-obra-nc", icone: "text-obra-nc", Icone: XCircle },
  em_vistoria: { celula: "bg-obra-info-fundo border-t-4 border-obra-info", barra: "bg-obra-info", icone: "text-obra-info", Icone: Clock },
  sem: { celula: "bg-obra-card border-2 border-dashed border-obra-neutro", barra: "bg-obra-neutro", icone: "text-obra-suave", Icone: Circle },
};

const descricao = (c: CelulaUnidade) =>
  `${c.local.nome} · ${ROTULO_SITUACAO[c.situacao]}${c.pendencias ? ` · ${c.pendencias} ${c.pendencias === 1 ? "pendência" : "pendências"}` : ""}${
    c.vistoria ? " · toque para abrir a vistoria" : " · toque para iniciar a vistoria"
  }`;

// Painel visual das vistorias de entrega do empreendimento: indicadores, divisão por situação
// e o mapa do prédio (pavimentos × unidades), além das áreas comuns.
export function PainelVistorias({ locais, vistorias }: { locais: Local[]; vistorias: { delivery: Delivery; localId: string | null }[] }) {
  const navigate = useNavigate();
  const painel = montarPainel(locais, vistorias);
  const [torreId, setTorreId] = useState<string>(painel.torres[0]?.torre.id ?? "");
  const torre = painel.torres.find((t) => t.torre.id === torreId) ?? painel.torres[0];

  if (!painel.totalUnidades && !painel.totalAreas) {
    return (
      <p className="obra-card p-4 text-sm text-obra-suave">
        Este empreendimento ainda não tem unidades cadastradas. Monte a estrutura em Empreendimento › Estrutura para ver o painel.
      </p>
    );
  }

  const abrir = (c: CelulaUnidade) =>
    c.vistoria ? navigate({ to: "/vistorias/$id", params: { id: c.vistoria.id } }) : navigate({ to: "/vistorias/nova", search: { local: c.local.id } });

  const Celula = ({ c, larga = false }: { c: CelulaUnidade; larga?: boolean }) => {
    const e = ESTILO[c.situacao];
    return (
      <button
        type="button"
        onClick={() => abrir(c)}
        title={descricao(c)}
        aria-label={descricao(c)}
        className={`relative flex min-h-12 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-extrabold text-obra-grafite transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obra-laranja-forte ${larga ? "min-w-28 justify-start px-3" : "min-w-12"} ${e.celula}`}
      >
        <e.Icone className={`h-4 w-4 shrink-0 ${e.icone}`} aria-hidden />
        <span className="truncate">{c.local.nome}</span>
        {c.pendencias > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-obra-nc px-1 text-[10px] font-extrabold text-white" aria-hidden>
            {c.pendencias}
          </span>
        )}
      </button>
    );
  };

  const maxUnidades = Math.max(1, ...(torre?.pavimentos.map((p) => p.unidades.length) ?? [1]));
  const areasDaTorre = torre ? [...torre.areas, ...torre.pavimentos.flatMap((p) => p.areas)] : [];

  return (
    <section className="obra-card space-y-5 p-4" aria-label="Painel das vistorias de entrega">
      {/* indicadores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { rotulo: "Unidades", valor: painel.totalUnidades, extra: painel.totalAreas ? `+ ${painel.totalAreas} áreas comuns` : "" },
          { rotulo: "Vistoriadas", valor: painel.vistoriadas, extra: `${pct(painel.vistoriadas, painel.totalUnidades)}% do total` },
          { rotulo: "Aprovadas", valor: painel.contagem.aprovada, extra: `${pct(painel.contagem.aprovada, painel.totalUnidades)}% do total` },
          { rotulo: "Com pendências", valor: painel.contagem.pendente, extra: painel.contagem.pendente ? "precisam de correção" : "nenhuma" },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-2xl bg-obra-fundo p-3">
            <p className="text-xs font-bold text-obra-suave">{k.rotulo}</p>
            <p className="text-3xl font-extrabold leading-tight text-obra-grafite">{k.valor}</p>
            {k.extra && <p className="text-xs text-obra-suave">{k.extra}</p>}
          </div>
        ))}
      </div>

      {/* divisão por situação: barra segmentada + legenda (sempre com ícone e número) */}
      {painel.totalUnidades > 0 && (
        <div className="space-y-2">
          <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={SITUACOES.map((s) => `${ROTULO_CURTO[s]}: ${painel.contagem[s]}`).join(", ")}>
            {SITUACOES.filter((s) => painel.contagem[s] > 0).map((s) => (
              <div key={s} className={`h-full first:rounded-l-full last:rounded-r-full ${ESTILO[s].barra}`} style={{ width: `${(painel.contagem[s] / painel.totalUnidades) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-obra-grafite">
            {SITUACOES.map((s) => {
              const e = ESTILO[s];
              return (
                <li key={s} className="flex items-center gap-1.5">
                  <e.Icone className={`h-4 w-4 ${e.icone}`} aria-hidden />
                  <span>
                    {ROTULO_CURTO[s]} <strong>{painel.contagem[s]}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* mapa do prédio */}
      {torre && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-obra-grafite">Unidades por pavimento</h3>
            <span className="text-xs text-obra-suave">do último pavimento ao térreo</span>
          </div>
          {painel.torres.length > 1 && (
            <Pilulas label="Torre" opcoes={painel.torres.map((t) => ({ v: t.torre.id, l: t.torre.nome }))} valor={torre.torre.id} onChange={setTorreId} />
          )}
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <table className="border-separate border-spacing-1.5" aria-label={`Unidades da ${torre.torre.nome} por pavimento`}>
              <tbody>
                {torre.pavimentos.map((p) => (
                  <tr key={p.pavimento.id}>
                    <th scope="row" className="sticky left-0 z-10 w-16 bg-obra-card pr-1 text-left text-xs font-bold whitespace-nowrap text-obra-suave">
                      {p.pavimento.nome.replace(/ pavimento$/, "")}
                    </th>
                    {p.unidades.map((c) => (
                      <td key={c.local.id}>
                        <Celula c={c} />
                      </td>
                    ))}
                    {/* completa a linha para as colunas ficarem alinhadas */}
                    {Array.from({ length: maxUnidades - p.unidades.length }, (_, k) => (
                      <td key={`vazio-${k}`} aria-hidden />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* áreas comuns */}
      {(painel.areasGerais.length > 0 || areasDaTorre.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-base font-extrabold text-obra-grafite">
            Áreas comuns <span className="text-sm font-bold text-obra-suave">({painel.areasVistoriadas} de {painel.totalAreas} vistoriadas)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...painel.areasGerais, ...areasDaTorre].map((c) => (
              <Celula key={c.local.id} c={c} larga />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
