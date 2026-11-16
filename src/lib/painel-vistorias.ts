// Painel visual das vistorias de entrega: situação de cada unidade, por torre e pavimento.
// Só lógica, sem acesso ao banco.
import { pendingCount, type Delivery } from "./delivery";
import { filhosDe, type Local } from "./empreendimentos";

// Situação da unidade pela vistoria mais recente.
export type Situacao = "aprovada" | "ressalvas" | "pendente" | "em_vistoria" | "sem";

export const SITUACOES: Situacao[] = ["aprovada", "ressalvas", "pendente", "em_vistoria", "sem"];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  aprovada: "Aprovada",
  ressalvas: "Aprovada com ressalvas / aguardando reinspeção",
  pendente: "Com pendências / reprovada",
  em_vistoria: "Em vistoria",
  sem: "Sem vistoria",
};
export const ROTULO_CURTO: Record<Situacao, string> = {
  aprovada: "Aprovadas",
  ressalvas: "Com ressalvas",
  pendente: "Com pendências",
  em_vistoria: "Em vistoria",
  sem: "Sem vistoria",
};

export function situacaoDaVistoria(d: Delivery | undefined): Situacao {
  if (!d) return "sem";
  const pend = pendingCount(d);
  if (d.result === "Reprovado – necessita correções" || pend > 0) return "pendente";
  if (d.result === "Aprovado com ressalvas" || d.result === "Aguardando reinspeção") return "ressalvas";
  if (d.result === "Aprovado para entrega") return "aprovada";
  return "em_vistoria";
}

export interface CelulaUnidade {
  local: Local;
  situacao: Situacao;
  vistoria?: Delivery | undefined; // a mais recente
  pendencias: number;
}
export interface LinhaPavimento {
  pavimento: Local;
  unidades: CelulaUnidade[];
  areas: CelulaUnidade[];
}
export interface BlocoTorre {
  torre: Local;
  pavimentos: LinhaPavimento[]; // do pavimento mais alto para o térreo (como a fachada do prédio)
  areas: CelulaUnidade[];
}

const numero = (nome: string) => {
  const m = nome.match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
};
// por número (101, 102… 1004); sem número, pela ordem e pelo nome
const porNumero = (a: Local, b: Local) => {
  const na = numero(a.nome);
  const nb = numero(b.nome);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
};

export function montarPainel(locais: Local[], vistorias: { delivery: Delivery; localId: string | null }[]) {
  // vistoria mais recente de cada local
  const ultima = new Map<string, Delivery>();
  for (const v of vistorias) {
    if (!v.localId) continue;
    const atual = ultima.get(v.localId);
    if (!atual || v.delivery.createdAt > atual.createdAt) ultima.set(v.localId, v.delivery);
  }
  const celula = (l: Local): CelulaUnidade => {
    const d = ultima.get(l.id);
    return { local: l, situacao: situacaoDaVistoria(d), vistoria: d, pendencias: d ? pendingCount(d) : 0 };
  };

  const torres: BlocoTorre[] = filhosDe(locais, null)
    .filter((l) => l.tipo === "torre")
    .map((torre) => {
      const filhos = filhosDe(locais, torre.id);
      const pavimentos = filhos
        .filter((l) => l.tipo === "pavimento")
        .sort((a, b) => porNumero(b, a)) // mais alto em cima
        .map((pavimento) => {
          const dentro = filhosDe(locais, pavimento.id);
          return {
            pavimento,
            unidades: dentro.filter((l) => l.tipo === "unidade").sort(porNumero).map(celula),
            areas: dentro.filter((l) => l.tipo === "area_comum").map(celula),
          };
        });
      return { torre, pavimentos, areas: filhos.filter((l) => l.tipo === "area_comum").map(celula) };
    });
  const areasGerais = filhosDe(locais, null).filter((l) => l.tipo === "area_comum").map(celula);

  const unidades = torres.flatMap((t) => t.pavimentos.flatMap((p) => p.unidades));
  const contagem = Object.fromEntries(SITUACOES.map((s) => [s, unidades.filter((u) => u.situacao === s).length])) as Record<Situacao, number>;
  const areas = [...areasGerais, ...torres.flatMap((t) => [...t.areas, ...t.pavimentos.flatMap((p) => p.areas)])];
  return {
    torres,
    areasGerais,
    contagem,
    totalUnidades: unidades.length,
    vistoriadas: unidades.length - contagem.sem,
    totalAreas: areas.length,
    areasVistoriadas: areas.filter((a) => a.situacao !== "sem").length,
  };
}

export const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);
