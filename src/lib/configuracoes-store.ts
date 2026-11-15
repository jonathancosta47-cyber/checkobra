// Acesso ao Supabase para as Configurações: modelos de FVS (via funções do banco) e empreiteiros.
import { supabase } from "@/integrations/supabase/client";
import type { Contractor } from "./fvs";
import { itensParaSalvar, soDigitos, type Empreiteiro, type ItemModelo, type ModeloResumo } from "./configuracoes";

const falhou = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ───────────── modelos ─────────────

const COLUNAS_MODELO = "id, empresa_id, nome, servico, versao, grupo_id, atual, ativo, modelo_itens(id, ordem, texto, criterio, exige_foto)";
type LinhaModelo = Omit<ModeloResumo, "itens"> & { modelo_itens: (ItemModelo & { ordem: number })[] };
const paraModelo = ({ modelo_itens, ...m }: LinhaModelo): ModeloResumo => ({
  ...m,
  itens: [...modelo_itens].sort((a, b) => a.ordem - b.ordem).map(({ ordem: _o, ...i }) => i),
});

// Versão atual de cada modelo (da empresa e padrão), incluindo os desativados.
export async function listarModelosAtuais(): Promise<ModeloResumo[]> {
  const { data, error } = await supabase.from("modelos_fvs").select(COLUNAS_MODELO).eq("atual", true).order("nome");
  falhou(error);
  return ((data ?? []) as unknown as LinhaModelo[]).map(paraModelo);
}

export async function lerModelo(id: string): Promise<ModeloResumo | null> {
  const { data, error } = await supabase.from("modelos_fvs").select(COLUNAS_MODELO).eq("id", id).maybeSingle();
  falhou(error);
  return data ? paraModelo(data as unknown as LinhaModelo) : null;
}

// Cria (id null) ou gera nova versão da versão atual. Retorna o id da versão salva.
export async function salvarModelo(p: { id: string | null; nome: string; servico: string; itens: ItemModelo[]; padrao?: boolean }) {
  const { data, error } = await supabase.rpc("salvar_modelo", {
    p_modelo_id: p.id as string, // null cria um modelo novo
    p_nome: p.nome,
    p_servico: p.servico,
    p_itens: itensParaSalvar(p.itens),
    p_padrao: p.padrao ?? false,
  });
  falhou(error);
  return data as string;
}

export async function duplicarModelo(id: string) {
  const { data, error } = await supabase.rpc("duplicar_modelo", { p_modelo_id: id });
  falhou(error);
  return data as string;
}

export async function definirModeloAtivo(id: string, ativo: boolean) {
  const { data, error } = await supabase.from("modelos_fvs").update({ ativo }).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

export async function souSuperAdmin() {
  const { data, error } = await supabase.rpc("sou_super_admin");
  if (error) return false;
  return data === true;
}

// ───────────── empreiteiros ─────────────

const COLUNAS_EMPREITEIRO = "id, nome, cnpj, contato_nome, telefone, email, servicos, ativo";

export async function listarEmpreiteiros(): Promise<Empreiteiro[]> {
  const { data, error } = await supabase.from("empreiteiros").select(COLUNAS_EMPREITEIRO).order("nome");
  falhou(error);
  return data ?? [];
}

export type DadosEmpreiteiro = Omit<Empreiteiro, "id" | "cnpj"> & { cnpj: string };

// Cria (sem id) ou atualiza. CNPJ é guardado só com os dígitos (ou vazio).
export async function salvarEmpreiteiro(id: string | null, e: DadosEmpreiteiro): Promise<Empreiteiro> {
  const campos = {
    nome: e.nome.trim(),
    cnpj: soDigitos(e.cnpj) || null,
    contato_nome: e.contato_nome.trim(),
    telefone: e.telefone.trim(),
    email: e.email.trim(),
    servicos: e.servicos.map((s) => s.trim()).filter(Boolean),
    ativo: e.ativo,
  };
  const q = id
    ? supabase.from("empreiteiros").update(campos).eq("id", id).select(COLUNAS_EMPREITEIRO).single()
    : supabase.from("empreiteiros").insert(campos).select(COLUNAS_EMPREITEIRO).single();
  const { data, error } = await q;
  if (error?.code === "23505") throw new Error("Já existe um empreiteiro com este CNPJ na sua empresa.");
  falhou(error);
  return data!;
}

export async function definirEmpreiteiroAtivo(id: string, ativo: boolean) {
  const { data, error } = await supabase.from("empreiteiros").update({ ativo }).eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// Traz os empreiteiros da tela antiga (salvos só no aparelho): nome e serviços dos contratos.
export async function importarEmpreiteirosDoAparelho(antigos: Contractor[]) {
  let n = 0;
  for (const c of antigos) {
    if (!c.name.trim()) continue;
    const servicos = [...new Set(c.contracts.map((k) => k.service.trim()).filter(Boolean))];
    const { error } = await supabase.from("empreiteiros").insert({ nome: c.name.trim(), servicos });
    if (error) throw new Error(error.message);
    n++;
  }
  return n;
}
