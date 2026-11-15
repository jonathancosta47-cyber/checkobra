// Acesso ao Supabase para a FVS multi-empresa. A empresa nunca é enviada:
// o banco preenche empresa_id sozinho e o RLS garante que cada um só vê a sua.
import { supabase } from "@/integrations/supabase/client";
import {
  caminhoDoLocal,
  contarRespostas,
  nomeDoCaminho,
  respostasDoModelo,
  type Inspecao,
  type InspecaoResumo,
  type Local,
  type Modelo,
  type Obra,
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

export async function listarObras(): Promise<Obra[]> {
  const { data, error } = await supabase.from("obras").select("id, nome, endereco, status").order("nome");
  falhou(error);
  return data ?? [];
}

export async function listarLocais(obraIds: string[]): Promise<Local[]> {
  if (!obraIds.length) return [];
  const { data, error } = await supabase
    .from("locais")
    .select("id, obra_id, pai_id, tipo, nome, ordem")
    .in("obra_id", obraIds);
  falhou(error);
  return data ?? [];
}

export async function listarModelos(): Promise<Modelo[]> {
  const { data, error } = await supabase
    .from("modelos_fvs")
    .select("id, nome, descricao, versao, ativo, modelo_itens(id, ordem, texto, criterio)")
    .order("nome");
  falhou(error);
  return (data ?? []).map(({ modelo_itens, ...m }) => ({ ...m, itens: [...modelo_itens].sort((a, b) => a.ordem - b.ordem) }));
}

// ───────────── inspeções ─────────────

const SELECT_INSPECAO =
  "id, numero, status, created_at, concluida_em, inspetor_id, obra_id, local_id, observacoes, obras(nome), modelos_fvs(nome), respostas(id, item_id, ordem, texto, criterio, resultado, observacao)";

type LinhaInspecao = {
  id: string; numero: number; status: InspecaoResumo["status"]; created_at: string; concluida_em: string | null;
  inspetor_id: string; obra_id: string; local_id: string; observacoes: string;
  obras: { nome: string } | null; modelos_fvs: { nome: string } | null; respostas: Resposta[];
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
    obraId: l.obra_id,
    obra: l.obras?.nome ?? "",
    localId: l.local_id,
    local: nomeDoCaminho(caminhoDoLocal(locais, l.local_id)),
    modelo: l.modelos_fvs?.nome ?? "",
    observacoes: l.observacoes,
    respostas,
    ...contarRespostas(respostas),
  };
}

export async function listarInspecoes(): Promise<InspecaoResumo[]> {
  const { data, error } = await supabase.from("inspecoes").select(SELECT_INSPECAO).order("created_at", { ascending: false });
  falhou(error);
  const linhas = (data ?? []) as unknown as LinhaInspecao[];
  const locais = await listarLocais([...new Set(linhas.map((l) => l.obra_id))]);
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
  return montar(linha, await listarLocais([linha.obra_id]));
}

// Cria a inspeção (rascunho) e copia os itens do modelo para as respostas.
// Se copiar os itens falhar, apaga a inspeção para não deixar uma ficha vazia.
export async function criarInspecao(obraId: string, localId: string, modelo: Modelo): Promise<string> {
  const { data, error } = await supabase
    .from("inspecoes")
    // numero: o banco calcula (FVS #1, #2... por empresa); o 0 é substituído
    .insert({ obra_id: obraId, local_id: localId, modelo_id: modelo.id, numero: 0 })
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
