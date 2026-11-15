// Acesso ao Supabase para a FVS multi-empresa. A empresa nunca é enviada:
// o banco preenche empresa_id sozinho e o RLS garante que cada um só vê a sua.
import { supabase } from "@/integrations/supabase/client";
import { listarLocais } from "./empreendimentos-store";
import {
  caminhoDoLocal,
  contarRespostas,
  nomeDoCaminho,
  respostasDoModelo,
  type Inspecao,
  type InspecaoResumo,
  type Local,
  type Modelo,
  type Perfil,
  type Resposta,
  type Resultado,
} from "./fvs-db";

const falhou = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ───────────── perfil e entrada na empresa ─────────────

export async function meuPerfil(): Promise<Perfil | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, papel, empresa_id, empresas(nome)")
    .eq("id", auth.user.id)
    .maybeSingle();
  falhou(error);
  if (!data) return null;
  return { id: data.id, nome: data.nome, papel: data.papel, empresaId: data.empresa_id, empresaNome: data.empresas?.nome ?? "" };
}

export async function criarEmpresa(nome: string, nomeUsuario: string) {
  const { error } = await supabase.rpc("criar_empresa", { p_nome: nome, p_nome_usuario: nomeUsuario });
  falhou(error);
}

export async function aceitarConvite(nomeUsuario: string) {
  const { error } = await supabase.rpc("aceitar_convite", { p_nome_usuario: nomeUsuario });
  falhou(error);
}

// ───────────── cadastros ─────────────

export async function listarModelos(): Promise<Modelo[]> {
  const { data, error } = await supabase
    .from("modelos_fvs")
    .select("id, empresa_id, nome, servico, descricao, versao, ativo, atual, modelo_itens(id, ordem, texto, criterio, exige_foto)")
    .eq("atual", true)
    .order("nome");
  falhou(error);
  return (data ?? []).map(({ modelo_itens, ...m }) => ({ ...m, itens: [...modelo_itens].sort((a, b) => a.ordem - b.ordem) }));
}

// ───────────── inspeções ─────────────

const SELECT_INSPECAO =
  "id, numero, status, created_at, concluida_em, inspetor_id, empreendimento_id, local_id, empreiteiro_id, observacoes, empreendimentos(nome), modelos_fvs(nome, versao, servico), respostas(id, item_id, ordem, texto, criterio, exige_foto, resultado, observacao)";

type LinhaInspecao = {
  id: string; numero: number; status: InspecaoResumo["status"]; created_at: string; concluida_em: string | null;
  inspetor_id: string; empreendimento_id: string; local_id: string; empreiteiro_id: string | null; observacoes: string;
  empreendimentos: { nome: string } | null; modelos_fvs: { nome: string; versao: number; servico: string } | null; respostas: Resposta[];
};

function montar(l: LinhaInspecao, locais: Local[]): Inspecao {
  const respostas = [...l.respostas].sort((a, b) => a.ordem - b.ordem);
  return {
    id: l.id,
    numero: l.numero,
    status: l.status,
    criadaEm: l.created_at,
    concluidaEm: l.concluida_em,
    inspetorId: l.inspetor_id,
    empreendimentoId: l.empreendimento_id,
    obra: l.empreendimentos?.nome ?? "",
    localId: l.local_id,
    local: nomeDoCaminho(caminhoDoLocal(locais, l.local_id)),
    modelo: l.modelos_fvs?.nome ?? "",
    modeloVersao: l.modelos_fvs?.versao ?? 1,
    modeloServico: l.modelos_fvs?.servico ?? "",
    empreiteiroId: l.empreiteiro_id,
    observacoes: l.observacoes,
    respostas,
    ...contarRespostas(respostas),
  };
}

// Inspeções de um empreendimento (ou de todos os visíveis, sem filtro).
export async function listarInspecoes(empreendimentoId?: string): Promise<InspecaoResumo[]> {
  let q = supabase.from("inspecoes").select(SELECT_INSPECAO).order("created_at", { ascending: false });
  if (empreendimentoId) q = q.eq("empreendimento_id", empreendimentoId);
  const { data, error } = await q;
  falhou(error);
  const linhas = (data ?? []) as unknown as LinhaInspecao[];
  const locais = await listarLocais([...new Set(linhas.map((l) => l.empreendimento_id))]);
  return linhas.map((l) => {
    const { respostas: _r, observacoes: _o, ...resumo } = montar(l, locais);
    return resumo;
  });
}

export async function lerInspecao(id: string): Promise<Inspecao | null> {
  const { data, error } = await supabase.from("inspecoes").select(SELECT_INSPECAO).eq("id", id).maybeSingle();
  falhou(error);
  if (!data) return null;
  const linha = data as unknown as LinhaInspecao;
  return montar(linha, await listarLocais([linha.empreendimento_id]));
}

// Cria a inspeção (rascunho) e copia os itens do modelo para as respostas.
// Se copiar os itens falhar, apaga a inspeção para não deixar uma ficha vazia.
export async function criarInspecao(empreendimentoId: string, localId: string, modelo: Modelo): Promise<string> {
  const { data, error } = await supabase
    .from("inspecoes")
    // numero: o banco calcula (FVS #1, #2... por empresa); o 0 é substituído
    .insert({ empreendimento_id: empreendimentoId, local_id: localId, modelo_id: modelo.id, numero: 0 })
    .select("id")
    .single();
  falhou(error);
  const id = data!.id;
  const itens = respostasDoModelo(id, modelo.itens);
  if (itens.length) {
    const { error: e2 } = await supabase.from("respostas").insert(itens);
    if (e2) {
      await supabase.from("inspecoes").delete().eq("id", id);
      throw new Error(e2.message);
    }
  }
  return id;
}

// Atualiza uma resposta. Retorna false se o banco recusou (sem permissão: o RLS devolve 0 linhas).
export async function salvarResposta(id: string, campos: { resultado?: Resultado | null; observacao?: string }) {
  const { data, error } = await supabase.from("respostas").update(campos).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function salvarObservacoes(id: string, observacoes: string) {
  const { data, error } = await supabase.from("inspecoes").update({ observacoes }).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function definirEmpreiteiro(id: string, empreiteiroId: string | null) {
  const { data, error } = await supabase.from("inspecoes").update({ empreiteiro_id: empreiteiroId }).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function concluirInspecao(id: string) {
  const { data, error } = await supabase
    .from("inspecoes")
    .update({ status: "concluida", concluida_em: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function reabrirInspecao(id: string) {
  const { data, error } = await supabase
    .from("inspecoes")
    .update({ status: "rascunho", concluida_em: null })
    .eq("id", id)
    .select("id");
  falhou(error);
  return (data ?? []).length > 0;
}
