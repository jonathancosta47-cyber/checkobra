// Acesso ao Supabase para a FVS multi-empresa. A empresa nunca é enviada:
// o banco preenche empresa_id sozinho e o RLS garante que cada um só vê a sua.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { listarLocais } from "./empreendimentos-store";
import { comprimirParaEnvio } from "./imagens";
import {
  caminhoDoLocal,
  contarRespostas,
  nomeDoCaminho,
  respostasDoModelo,
  type Assinatura,
  type FotoFvs,
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
  "id, numero, status, created_at, concluida_em, inspetor_id, empreendimento_id, local_id, empreiteiro_id, observacoes, assinaturas, pdf_path, pdf_gerado_em, empreendimentos(nome), modelos_fvs(nome, versao, servico), perfis(nome), empreiteiros(nome, cnpj), respostas(id, item_id, ordem, texto, criterio, exige_foto, resultado, observacao)";

type LinhaInspecao = {
  id: string; numero: number; status: InspecaoResumo["status"]; created_at: string; concluida_em: string | null;
  inspetor_id: string; empreendimento_id: string; local_id: string; empreiteiro_id: string | null; observacoes: string;
  assinaturas: Json; pdf_path: string | null; pdf_gerado_em: string | null;
  empreendimentos: { nome: string } | null; modelos_fvs: { nome: string; versao: number; servico: string } | null;
  perfis: { nome: string } | null; empreiteiros: { nome: string; cnpj: string | null } | null; respostas: Resposta[];
};

const lerAssinaturas = (j: Json): Assinatura[] =>
  Array.isArray(j)
    ? j.flatMap((a) => {
        const x = a as { papel?: unknown; nome?: unknown; imagem?: unknown } | null;
        if (!x || (x.papel !== "inspetor" && x.papel !== "empreiteiro")) return [];
        return [{ papel: x.papel, nome: typeof x.nome === "string" ? x.nome : "", imagem: typeof x.imagem === "string" ? x.imagem : null }];
      })
    : [];

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
    pdfPath: l.pdf_path,
    pdfGeradoEm: l.pdf_gerado_em,
    assinaturas: lerAssinaturas(l.assinaturas),
    inspetorNome: l.perfis?.nome ?? "",
    empreiteiroNome: l.empreiteiros?.nome ?? "",
    empreiteiroCnpj: l.empreiteiros?.cnpj ?? null,
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
    const { respostas: _r, observacoes: _o, assinaturas: _a, inspetorNome: _i, empreiteiroNome: _e, empreiteiroCnpj: _c, ...resumo } = montar(l, locais);
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

// ───────────── assinaturas ─────────────

export async function salvarAssinaturas(id: string, assinaturas: Assinatura[]) {
  const { data, error } = await supabase
    .from("inspecoes")
    .update({ assinaturas: assinaturas as unknown as Json })
    .eq("id", id)
    .select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// ───────────── fotos (bucket fvs-fotos: <empresa>/<empreendimento>/<fvs>/<arquivo>) ─────────────

const BUCKET_FOTOS = "fvs-fotos";
const BUCKET_PDFS = "fvs-pdfs";

async function linksTemporarios(bucket: string, caminhos: string[]): Promise<Record<string, string>> {
  if (!caminhos.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(caminhos, 3600);
  if (error) return {};
  const pares: [string, string][] = [];
  for (const d of data ?? []) if (d.path && d.signedUrl) pares.push([d.path, d.signedUrl]);
  return Object.fromEntries(pares);
}

export async function listarFotos(inspecaoId: string): Promise<FotoFvs[]> {
  const { data, error } = await supabase
    .from("fvs_fotos")
    .select("id, resposta_id, storage_path, ordem, created_at")
    .eq("inspecao_id", inspecaoId)
    .order("ordem")
    .order("created_at");
  falhou(error);
  const linhas = data ?? [];
  const urls = await linksTemporarios(BUCKET_FOTOS, linhas.map((f) => f.storage_path));
  return linhas.map((f) => ({ id: f.id, respostaId: f.resposta_id, storagePath: f.storage_path, url: urls[f.storage_path] ?? "" }));
}

// Comprime no aparelho, envia ao Storage e registra a foto no item. Se registrar falhar, apaga o arquivo.
export async function enviarFotoFvs(p: { empresaId: string; empreendimentoId: string; inspecaoId: string; respostaId: string; arquivo: File; ordem: number }): Promise<FotoFvs> {
  const blob = await comprimirParaEnvio(p.arquivo);
  const caminho = `${p.empresaId}/${p.empreendimentoId}/${p.inspecaoId}/${p.respostaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: e1 } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, blob, { contentType: "image/jpeg" });
  falhou(e1);
  const { data, error } = await supabase
    .from("fvs_fotos")
    .insert({ inspecao_id: p.inspecaoId, resposta_id: p.respostaId, empreendimento_id: p.empreendimentoId, storage_path: caminho, ordem: p.ordem })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET_FOTOS).remove([caminho]);
    throw new Error(error.message);
  }
  const urls = await linksTemporarios(BUCKET_FOTOS, [caminho]);
  return { id: data!.id, respostaId: p.respostaId, storagePath: caminho, url: urls[caminho] ?? URL.createObjectURL(blob) };
}

export async function removerFotoFvs(foto: Pick<FotoFvs, "id" | "storagePath">) {
  const { data, error } = await supabase.from("fvs_fotos").delete().eq("id", foto.id).select("id");
  falhou(error);
  if (!(data ?? []).length) return false;
  await supabase.storage.from(BUCKET_FOTOS).remove([foto.storagePath]);
  return true;
}

// ───────────── PDF (bucket fvs-pdfs) ─────────────

// Guarda o PDF da FVS concluída e registra na FVS. Retorna o caminho salvo.
export async function salvarPdfFvs(p: { empresaId: string; empreendimentoId: string; inspecaoId: string; nome: string; pdf: Blob }) {
  const caminho = `${p.empresaId}/${p.empreendimentoId}/${p.inspecaoId}/${Date.now()}-${p.nome}`;
  const { error } = await supabase.storage.from(BUCKET_PDFS).upload(caminho, p.pdf, { contentType: "application/pdf" });
  falhou(error);
  const { error: e2 } = await supabase.rpc("registrar_pdf_fvs", { p_inspecao: p.inspecaoId, p_path: caminho });
  falhou(e2);
  return caminho;
}

export async function baixarPdfSalvo(caminho: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET_PDFS).download(caminho);
  falhou(error);
  return data!;
}
