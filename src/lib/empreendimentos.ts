// Empreendimentos e sua estrutura (torre > pavimento > unidade, e áreas comuns).
// Só lógica, sem acesso ao Supabase.
import type { Database } from "@/integrations/supabase/types";

type Tabelas = Database["public"]["Tables"];
export type TipoLocal = Database["public"]["Enums"]["tipo_local"];
export type Empreendimento = Pick<Tabelas["empreendimentos"]["Row"], "id" | "nome" | "endereco" | "status" | "foto_path">;
export type Local = Pick<Tabelas["locais"]["Row"], "id" | "empreendimento_id" | "pai_id" | "tipo" | "nome" | "ordem">;

export const TIPO_ROTULO: Record<TipoLocal, string> = {
  torre: "Torre",
  pavimento: "Pavimento",
  unidade: "Unidade",
  area_comum: "Área comum",
};

// O que pode ser criado dentro de cada tipo (null = raiz do empreendimento).
export function tiposFilhos(tipoPai: TipoLocal | null): TipoLocal[] {
  if (tipoPai === null) return ["torre", "area_comum"];
  if (tipoPai === "torre") return ["pavimento", "area_comum"];
  if (tipoPai === "pavimento") return ["unidade", "area_comum"];
  return [];
}
// Próximo nível "natural" (usado no assistente e na escolha de local).
export const PROXIMO_TIPO: Record<TipoLocal, TipoLocal | null> = { torre: "pavimento", pavimento: "unidade", unidade: null, area_comum: null };

// ───────────── árvore ─────────────

const PESO: Record<TipoLocal, number> = { torre: 0, pavimento: 0, unidade: 0, area_comum: 1 }; // áreas comuns no fim
const porOrdem = (a: Local, b: Local) =>
  PESO[a.tipo] - PESO[b.tipo] || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });

export const filhosDe = (locais: Local[], paiId: string | null) => locais.filter((l) => l.pai_id === paiId).sort(porOrdem);

export function caminhoDoLocal(locais: Local[], localId: string): Local[] {
  const porId = new Map(locais.map((l) => [l.id, l]));
  const caminho: Local[] = [];
  let atual = porId.get(localId);
  while (atual && caminho.length < 4) {
    caminho.unshift(atual);
    atual = atual.pai_id ? porId.get(atual.pai_id) : undefined;
  }
  return caminho;
}
export const nomeDoCaminho = (caminho: Pick<Local, "nome">[]) => caminho.map((l) => l.nome).join(" › ");

// Todos os descendentes (para avisar quantos itens somem ao remover).
export function descendentes(locais: Local[], id: string): Local[] {
  const fora: Local[] = [];
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const f of locais.filter((l) => l.pai_id === atual)) {
      fora.push(f);
      fila.push(f.id);
    }
  }
  return fora;
}

export function contarPorTipo(locais: Pick<Local, "tipo">[]): Record<TipoLocal, number> {
  const c: Record<TipoLocal, number> = { torre: 0, pavimento: 0, unidade: 0, area_comum: 0 };
  for (const l of locais) c[l.tipo]++;
  return c;
}

// ───────────── nomes e numeração ─────────────

const numeroDe = (nome: string) => {
  const m = nome.match(/\d+/);
  return m ? Number(m[0]) : 0;
};

// Nome sugerido ao adicionar um local, seguindo o padrão do assistente.
export function sugerirNome(locais: Local[], pai: Local | null, tipo: TipoLocal): string {
  const irmaos = filhosDe(locais, pai?.id ?? null).filter((l) => l.tipo === tipo);
  if (tipo === "torre") {
    const usadas = new Set(irmaos.map((l) => l.nome));
    for (let i = 0; i < 26; i++) {
      const nome = `Torre ${String.fromCharCode(65 + i)}`;
      if (!usadas.has(nome)) return nome;
    }
    return `Torre ${irmaos.length + 1}`;
  }
  if (tipo === "pavimento") return `${Math.max(0, ...irmaos.map((l) => numeroDe(l.nome))) + 1}º pavimento`;
  if (tipo === "unidade") {
    const andar = pai ? numeroDe(pai.nome) : 0;
    const maior = Math.max(andar * 100, ...irmaos.map((l) => numeroDe(l.nome)));
    return String(maior + 1);
  }
  return "Nova área comum";
}

export const proximaOrdem = (locais: Local[], paiId: string | null) =>
  Math.max(0, ...filhosDe(locais, paiId).map((l) => l.ordem)) + 1;

export interface ParametrosEstrutura {
  torres: number;
  pavimentos: number;
  unidades: number;
}
// Prévia do que o assistente vai criar (a mesma regra da função criar_empreendimento do banco).
export function previaEstrutura({ torres, pavimentos, unidades }: ParametrosEstrutura) {
  return {
    torres,
    pavimentos: torres * pavimentos,
    unidades: torres * pavimentos * unidades,
    nomesTorres: Array.from({ length: torres }, (_, i) => `Torre ${String.fromCharCode(65 + i)}`),
    primeiraUnidade: torres && pavimentos && unidades ? "101" : "",
    ultimaUnidade: torres && pavimentos && unidades ? String(pavimentos * 100 + unidades) : "",
  };
}

export function validarEstrutura(p: ParametrosEstrutura & { nome: string }): string | null {
  if (!p.nome.trim()) return "Informe o nome do empreendimento.";
  if (!Number.isInteger(p.torres) || p.torres < 0 || p.torres > 26) return "Use de 0 a 26 torres.";
  if (!Number.isInteger(p.pavimentos) || p.pavimentos < 1 || p.pavimentos > 200) return "Use de 1 a 200 pavimentos por torre.";
  if (!Number.isInteger(p.unidades) || p.unidades < 1 || p.unidades > 99) return "Use de 1 a 99 unidades por pavimento.";
  return null;
}

// ───────────── progresso do empreendimento ─────────────
// % de unidades com vistoria de entrega aprovada (com ou sem ressalvas).

export const APROVADAS = ["Aprovado para entrega", "Aprovado com ressalvas"];
export function progressoEntrega(totalUnidades: number, vistorias: { local_id: string | null; resultado: string | null }[]) {
  const aprovadas = new Set(vistorias.filter((v) => v.local_id && APROVADAS.includes(v.resultado ?? "")).map((v) => v.local_id));
  return {
    aprovadas: aprovadas.size,
    total: totalUnidades,
    pct: totalUnidades ? Math.round((Math.min(aprovadas.size, totalUnidades) / totalUnidades) * 100) : 0,
  };
}
