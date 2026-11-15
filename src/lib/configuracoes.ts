// Regras das Configurações (modelos de FVS e empreiteiros). Só lógica, sem acesso ao banco.
import type { Database } from "@/integrations/supabase/types";

type Tabelas = Database["public"]["Tables"];

export type ModeloResumo = Pick<
  Tabelas["modelos_fvs"]["Row"],
  "id" | "empresa_id" | "nome" | "servico" | "versao" | "grupo_id" | "atual" | "ativo"
> & { itens: ItemModelo[] };
export interface ItemModelo {
  id?: string;
  texto: string;
  criterio: string;
  exige_foto: boolean;
}
export type Empreiteiro = Pick<
  Tabelas["empreiteiros"]["Row"],
  "id" | "nome" | "cnpj" | "contato_nome" | "telefone" | "email" | "servicos" | "ativo"
>;

export const ehPadrao = (m: Pick<ModeloResumo, "empresa_id">) => m.empresa_id === null;

// ───────────── modelos ─────────────

export function validarModelo(m: { nome: string; itens: ItemModelo[] }): string | null {
  if (!m.nome.trim()) return "Informe o nome do modelo.";
  if (!m.itens.length) return "Adicione ao menos um item de verificação.";
  const vazio = m.itens.findIndex((i) => !i.texto.trim());
  if (vazio >= 0) return `O item ${vazio + 1} está sem descrição.`;
  return null;
}

// Itens no formato que a função salvar_modelo do banco espera.
export const itensParaSalvar = (itens: ItemModelo[]) =>
  itens.map((i) => ({ texto: i.texto.trim(), criterio: i.criterio.trim(), exige_foto: i.exige_foto }));

// Ordem de exibição: da empresa antes dos padrão; depois por nome.
export const ordenarModelos = <T extends Pick<ModeloResumo, "empresa_id" | "nome">>(ms: T[]) =>
  [...ms].sort((a, b) => Number(ehPadrao(a)) - Number(ehPadrao(b)) || a.nome.localeCompare(b.nome, "pt-BR"));

// Modelos que podem ser usados numa FVS nova: ativos e na versão atual.
export const modelosParaFvs = <T extends Pick<ModeloResumo, "empresa_id" | "nome" | "ativo" | "atual">>(ms: T[]) =>
  ordenarModelos(ms.filter((m) => m.ativo && m.atual));

export const moverItem = <T>(lista: T[], de: number, para: number): T[] => {
  if (para < 0 || para >= lista.length) return lista;
  const nova = [...lista];
  const [x] = nova.splice(de, 1);
  nova.splice(para, 0, x!);
  return nova;
};

// ───────────── empreiteiros ─────────────

export const soDigitos = (v: string) => v.replace(/\D/g, "");

export function formatarCnpj(v: string | null | undefined) {
  const d = soDigitos(v ?? "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// CNPJ com dígitos verificadores corretos (aceita com ou sem pontuação).
export function cnpjValido(v: string) {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const c of base) {
      soma += Number(c) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

export function validarEmpreiteiro(e: { nome: string; cnpj: string; email: string }): string | null {
  if (!e.nome.trim()) return "Informe o nome do empreiteiro.";
  if (e.cnpj.trim() && !cnpjValido(e.cnpj)) return "CNPJ inválido. Confira os números.";
  if (e.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email.trim())) return "E-mail inválido.";
  return null;
}

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Para a FVS: ativos, primeiro os que executam o serviço do modelo.
export function empreiteirosParaServico<T extends Pick<Empreiteiro, "nome" | "servicos" | "ativo">>(lista: T[], servico: string) {
  const alvo = normal(servico);
  const executa = (e: T) => !!alvo && e.servicos.some((s) => normal(s) === alvo);
  return lista
    .filter((e) => e.ativo)
    .sort((a, b) => Number(executa(b)) - Number(executa(a)) || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((e) => ({ ...e, executaServico: executa(e) }));
}

// Lista de serviços sem repetição (para sugestões), ignorando maiúsculas e acentos.
export function servicosUnicos(listas: string[][]) {
  const vistos = new Map<string, string>();
  for (const s of listas.flat()) {
    const k = normal(s);
    if (k && !vistos.has(k)) vistos.set(k, s.trim());
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
