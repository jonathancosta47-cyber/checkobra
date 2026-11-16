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
  pdfPath: string | null;
  pdfGeradoEm: string | null;
  total: number;
  respondidos: number;
  nc: number;
}

export interface Assinatura {
  papel: "inspetor" | "empreiteiro";
  nome: string;
  imagem: string | null; // data URL do desenho
}

export interface FotoFvs {
  id: string;
  respostaId: string;
  storagePath: string;
  url: string; // link temporário para mostrar
}

export interface Inspecao extends InspecaoResumo {
  observacoes: string;
  respostas: Resposta[];
  assinaturas: Assinatura[];
  inspetorNome: string;
  empreiteiroNome: string;
  empreiteiroCnpj: string | null;
}

export const PAPEL_ASSINATURA: Record<Assinatura["papel"], string> = {
  inspetor: "Inspetor responsável",
  empreiteiro: "Empreiteiro responsável",
};

// Garante as duas assinaturas (inspetor e empreiteiro), mantendo o que já foi assinado.
export function assinaturasCompletas(salvas: Assinatura[], nomes: { inspetor: string; empreiteiro: string }): Assinatura[] {
  return (["inspetor", "empreiteiro"] as const).map((papel) => {
    const a = salvas.find((x) => x.papel === papel);
    return { papel, nome: a?.nome || nomes[papel], imagem: a?.imagem ?? null };
  });
}

// Nome do arquivo do PDF: FVS-0007-alvenaria-de-vedacao.pdf
export function nomePdfFvs(numero: number, modelo: string) {
  const slug = modelo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `FVS-${String(numero).padStart(4, "0")}${slug ? `-${slug}` : ""}.pdf`;
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

// Para concluir (as mesmas regras que o banco confere): todos os itens respondidos, toda NC descrita,
// foto nos itens que exigem (quando C ou NC) e a assinatura do inspetor.
export function motivoParaNaoConcluir(
  rs: Resposta[],
  fotosPorResposta: Record<string, number> = {},
  assinaturas: Pick<Assinatura, "papel" | "imagem">[] | null = null,
): string | null {
  const faltam = rs.filter((r) => r.resultado === null).length;
  if (faltam) return faltam === 1 ? "Falta responder 1 item." : `Faltam responder ${faltam} itens.`;
  const ncSemObs = rs.filter((r) => r.resultado === "NC" && !r.observacao.trim()).length;
  if (ncSemObs) return ncSemObs === 1 ? "Descreva o problema do item não conforme." : `Descreva o problema dos ${ncSemObs} itens não conformes.`;
  const semFoto = rs.filter((r) => r.exige_foto && (r.resultado === "C" || r.resultado === "NC") && !fotosPorResposta[r.id]).length;
  if (semFoto) return semFoto === 1 ? "1 item exige foto e está sem foto." : `${semFoto} itens exigem foto e estão sem foto.`;
  if (assinaturas && !assinaturas.some((a) => a.papel === "inspetor" && a.imagem?.startsWith("data:image/")))
    return "Falta a assinatura do inspetor.";
  return null;
}

// Quem pode editar (a mesma regra do banco; a tela usa só para mostrar ou esconder botões).
export const podeEditar = (perfil: Pick<Perfil, "id" | "papel">, i: Pick<InspecaoResumo, "status" | "inspetorId">) =>
  gerencia(perfil.papel) || (i.inspetorId === perfil.id && i.status === "rascunho");

// Quem pode excluir (a mesma regra do banco): admin e engenheiro sempre; o inspetor só a própria, em rascunho.
export const podeExcluir = (perfil: Pick<Perfil, "id" | "papel">, i: Pick<InspecaoResumo, "status" | "inspetorId">) =>
  gerencia(perfil.papel) || (i.inspetorId === perfil.id && i.status === "rascunho");

export const numeroFvs = (n: number) => `FVS #${String(n).padStart(4, "0")}`;
