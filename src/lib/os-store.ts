// Ordens de Serviço no Supabase. Os campos da OS (cliente, serviço, checklist, fotos, assinaturas)
// ficam em "dados" no mesmo formato que os formulários já usam (ServiceOrder).
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ServiceOrder } from "./orders";

export interface VinculoOS {
  empreendimentoId: string;
  localId: string | null;
}

type Linha = {
  id: string;
  numero: number;
  status: ServiceOrder["status"];
  created_at: string;
  empreendimento_id: string;
  local_id: string | null;
  dados: Json;
};
const COLUNAS = "id, numero, status, created_at, empreendimento_id, local_id, dados";

// Linha do banco → formato dos formulários.
export function paraOrdem(l: Linha): ServiceOrder {
  const d = (l.dados ?? {}) as Partial<ServiceOrder>;
  return {
    client: { name: "", phone: "", email: "", document: "", address: "" },
    equipment: "",
    problem: "",
    service: "",
    technician: "",
    value: "",
    photos: [],
    signature: null,
    signedBy: "",
    ...d,
    id: l.id,
    number: l.numero,
    status: l.status,
    createdAt: l.created_at,
  };
}

// Formato dos formulários → campo "dados" (sem o que já tem coluna própria).
export function paraDados(o: ServiceOrder): Json {
  const { id: _id, number: _n, status: _s, createdAt: _c, ...dados } = o;
  return dados as unknown as Json;
}

const falhou = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function listarOS(empreendimentoId?: string): Promise<ServiceOrder[]> {
  let q = supabase.from("ordens_servico").select(COLUNAS).order("created_at", { ascending: false });
  if (empreendimentoId) q = q.eq("empreendimento_id", empreendimentoId);
  const { data, error } = await q;
  falhou(error);
  return ((data ?? []) as Linha[]).map(paraOrdem);
}

export async function lerOS(id: string): Promise<{ ordem: ServiceOrder; vinculo: VinculoOS } | null> {
  const { data, error } = await supabase.from("ordens_servico").select(COLUNAS).eq("id", id).maybeSingle();
  falhou(error);
  if (!data) return null;
  const l = data as Linha;
  return { ordem: paraOrdem(l), vinculo: { empreendimentoId: l.empreendimento_id, localId: l.local_id } };
}

// Salva: atualiza se já existe; senão cria (o número é dado pelo banco). Retorna a OS salva.
export async function salvarOS(o: ServiceOrder, vinculo: VinculoOS): Promise<ServiceOrder> {
  const campos = { status: o.status, dados: paraDados(o), empreendimento_id: vinculo.empreendimentoId, local_id: vinculo.localId };
  const { data: atualizada, error } = await supabase.from("ordens_servico").update(campos).eq("id", o.id).select(COLUNAS);
  falhou(error);
  if (atualizada?.length) return paraOrdem(atualizada[0] as Linha);
  const { data, error: e2 } = await supabase
    .from("ordens_servico")
    // numero: o banco calcula (OS #1, #2... por empresa); o 0 é substituído
    .insert({ id: o.id, numero: 0, ...campos })
    .select(COLUNAS)
    .single();
  falhou(e2);
  return paraOrdem(data as Linha);
}

export async function apagarOS(id: string) {
  const { data, error } = await supabase.from("ordens_servico").delete().eq("id", id).select("id");
  falhou(error);
  return (data ?? []).length > 0;
}

// Traz para o banco as OS que estavam salvas só neste aparelho (sem apagar as do aparelho).
export async function importarOSDoAparelho(ordens: ServiceOrder[], empreendimentoId: string) {
  if (!ordens.length) return 0;
  const linhas = ordens.map((o) => ({
    id: o.id,
    numero: 0,
    status: o.status,
    dados: { ...(paraDados(o) as object), numeroNoAparelho: o.number, criadaNoAparelhoEm: o.createdAt } as Json,
    empreendimento_id: empreendimentoId,
  }));
  // uma por vez, na ordem em que foram criadas, para a numeração seguir a mesma ordem
  let importadas = 0;
  for (const l of [...linhas].reverse()) {
    const { error } = await supabase.from("ordens_servico").insert(l);
    if (!error) importadas++;
    else if (!error.message.includes("duplicate")) throw new Error(error.message);
  }
  return importadas;
}
