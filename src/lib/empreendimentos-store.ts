// Acesso ao Supabase para empreendimentos e estrutura. A empresa nunca é enviada:
// o banco preenche empresa_id e o RLS mostra só o que cada pessoa pode ver.
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "./orders";
import { progressoEntrega, type Empreendimento, type Local, type TipoLocal } from "./empreendimentos";

const falhou = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};
const BUCKET = "empreendimentos";

export async function listarEmpreendimentos(): Promise<Empreendimento[]> {
  const { data, error } = await supabase.from("empreendimentos").select("id, nome, endereco, status, foto_path").order("nome");
  falhou(error);
  return data ?? [];
}

export async function criarEmpreendimento(p: {
  nome: string; endereco: string; torres: number; pavimentos: number; unidades: number; areasComuns: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("criar_empreendimento", {
    p_nome: p.nome,
    p_endereco: p.endereco,
    p_torres: p.torres,
    p_pavimentos: p.pavimentos,
    p_unidades: p.unidades,
    p_areas_comuns: p.areasComuns,
  });
  falhou(error);
  return data as string;
}

export async function atualizarEmpreendimento(id: string, campos: Partial<Pick<Empreendimento, "nome" | "endereco" | "status">>) {
  const { data, error } = await supabase.from("empreendimentos").update(campos).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function apagarEmpreendimento(id: string) {
  const { data, error } = await supabase.from("empreendimentos").delete().eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// Foto: reduzida no aparelho e guardada em "<empresa>/<empreendimento>/capa-<data>.jpg".
export async function enviarFoto(empresaId: string, empreendimentoId: string, arquivo: File) {
  const dataUrl = await compressImage(arquivo);
  const blob = await (await fetch(dataUrl)).blob();
  const caminho = `${empresaId}/${empreendimentoId}/capa-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
  falhou(error);
  const { error: e2 } = await supabase.from("empreendimentos").update({ foto_path: caminho }).eq("id", empreendimentoId);
  falhou(e2);
  return caminho;
}

// Links temporários (1 hora) para mostrar as fotos do bucket privado.
export async function urlsDasFotos(caminhos: string[]): Promise<Record<string, string>> {
  const validos = [...new Set(caminhos.filter(Boolean))];
  if (!validos.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(validos, 3600);
  if (error) return {};
  const pares: [string, string][] = [];
  for (const d of data ?? []) if (d.path && d.signedUrl) pares.push([d.path, d.signedUrl]);
  return Object.fromEntries(pares);
}

// ───────────── estrutura ─────────────

export async function listarLocais(empreendimentoIds: string[]): Promise<Local[]> {
  if (!empreendimentoIds.length) return [];
  const { data, error } = await supabase
    .from("locais")
    .select("id, empreendimento_id, pai_id, tipo, nome, ordem")
    .in("empreendimento_id", empreendimentoIds);
  falhou(error);
  return data ?? [];
}

export async function adicionarLocal(l: { empreendimentoId: string; paiId: string | null; tipo: TipoLocal; nome: string; ordem: number }): Promise<Local> {
  const { data, error } = await supabase
    .from("locais")
    .insert({ empreendimento_id: l.empreendimentoId, pai_id: l.paiId, tipo: l.tipo, nome: l.nome.trim(), ordem: l.ordem })
    .select("id, empreendimento_id, pai_id, tipo, nome, ordem")
    .single();
  falhou(error);
  return data!;
}

export async function renomearLocal(id: string, nome: string) {
  const { data, error } = await supabase.from("locais").update({ nome: nome.trim() }).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// Remove o local e tudo o que estiver dentro dele (o banco apaga em cascata).
export async function removerLocal(id: string) {
  const { data, error } = await supabase.from("locais").delete().eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// ───────────── progresso (cartões da Início) ─────────────

export async function progressoDosEmpreendimentos(ids: string[]) {
  if (!ids.length) return {};
  // contagem feita pelo banco (não esbarra no limite de 1.000 linhas por consulta)
  const contagens = await Promise.all(
    ids.map((id) =>
      supabase.from("locais").select("id", { count: "exact", head: true }).eq("tipo", "unidade").eq("empreendimento_id", id),
    ),
  );
  const vistorias = await supabase
    .from("delivery_inspections")
    .select("empreendimento_id, local_id, resultado:data->>result")
    .in("empreendimento_id", ids);
  falhou(vistorias.error);
  const vs = (vistorias.data ?? []) as { empreendimento_id: string; local_id: string | null; resultado: string | null }[];
  return Object.fromEntries(
    ids.map((id, k) => [id, progressoEntrega(contagens[k]?.count ?? 0, vs.filter((v) => v.empreendimento_id === id))]),
  ) as Record<string, ReturnType<typeof progressoEntrega>>;
}
