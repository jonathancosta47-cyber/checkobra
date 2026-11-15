// Regras da FVS no banco (multi-empresa). Só lógica, sem acesso ao Supabase.
import type { Database } from "@/integrations/supabase/types";
export { caminhoDoLocal, filhosDe, nomeDoCaminho, PROXIMO_TIPO, TIPO_ROTULO, type Local, type TipoLocal } from "./empreendimentos";

type Tabelas = Database["public"]["Tables"];
export type Papel = Database["public"]["Enums"]["papel_usuario"];
export type Resultado = Database["public"]["Enums"]["resultado_item"];
export type StatusInspecao = Database["public"]["Enums"]["status_inspecao"];

export type ModeloItem = Pick<Tabelas["modelo_itens"]["Row"], "id" | "ordem" | "texto" | "criterio" | "exige_foto">;
export type Modelo = Pick<Tabelas["modelos_fvs"]["Row"], "id" | "empresa_id" | "nome" | "servico" | "descricao" | "versao" | "ativo" | "atual"> & {
  itens: ModeloItem[];
};
export type Resposta = Pick<Tabelas["respostas"]["Row"], "id" | "item_id" | "ordem" | "texto" | "criterio" | "exige_foto" | "resultado" | "observacao">;

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  empresaId: string;
  empresaNome: string;
}

export interface InspecaoResumo {
  id: string;
  numero: number;
  status: StatusInspecao;
  criadaEm: string;
  concluidaEm: string | null;
  inspetorId: string;
  empreendimentoId: string;
  obra: string; // nome do empreendimento
  localId: string;
  local: string; // caminho: "Torre A › 1º pavimento › Apto 101"
  modelo: string;
  modeloVersao: number;
  modeloServico: string;
  empreiteiroId: string | null;
  total: number;
  respondidos: number;
  nc: number;
}

export interface Inspecao extends InspecaoResumo {
  observacoes: string;
  respostas: Resposta[];
}

export const PAPEL_ROTULO: Record<Papel, string> = {
  admin_empresa: "Admin da empresa",
  engenheiro: "Engenheiro",
  inspetor: "Inspetor",
};
export const RESULTADO_ROTULO: Record<Resultado, string> = { C: "Conforme", NC: "Não conforme", NA: "Não se aplica" };

export const gerencia = (p: Papel) => p === "admin_empresa" || p === "engenheiro";

// ───────────── respostas ─────────────

// Copia os itens do modelo para a inspeção (texto e critério ficam guardados na resposta).
export const respostasDoModelo = (inspecaoId: string, itens: ModeloItem[]) =>
  [...itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i, k) => ({ inspecao_id: inspecaoId, item_id: i.id, ordem: k + 1, texto: i.texto, criterio: i.criterio, exige_foto: i.exige_foto }));

export function contarRespostas(rs: Pick<Resposta, "resultado">[]) {
  return {
    total: rs.length,
    respondidos: rs.filter((r) => r.resultado !== null).length,
    nc: rs.filter((r) => r.resultado === "NC").length,
  };
}
export const progresso = (i: Pick<InspecaoResumo, "total" | "respondidos">) =>
  i.total ? Math.round((i.respondidos / i.total) * 100) : 0;

// Para concluir: todos os itens respondidos e toda NC com observação explicando o problema.
export function motivoParaNaoConcluir(rs: Resposta[]): string | null {
  const faltam = rs.filter((r) => r.resultado === null).length;
  if (faltam) return faltam === 1 ? "Falta responder 1 item." : `Faltam responder ${faltam} itens.`;
  const ncSemObs = rs.filter((r) => r.resultado === "NC" && !r.observacao.trim()).length;
  if (ncSemObs) return ncSemObs === 1 ? "Descreva o problema do item não conforme." : `Descreva o problema dos ${ncSemObs} itens não conformes.`;
  return null;
}

// Quem pode editar (a mesma regra do banco; a tela usa só para mostrar ou esconder botões).
export const podeEditar = (perfil: Pick<Perfil, "id" | "papel">, i: Pick<InspecaoResumo, "status" | "inspetorId">) =>
  gerencia(perfil.papel) || (i.inspetorId === perfil.id && i.status === "rascunho");

export const numeroFvs = (n: number) => `FVS #${String(n).padStart(4, "0")}`;
