import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Delivery } from "./delivery";

// Onde a vistoria fica: empreendimento (obrigatório) e unidade/local (opcional).
export interface VinculoVistoria {
  empreendimentoId: string;
  localId: string | null;
}

// Vistorias de um empreendimento (ou de todos os visíveis, sem filtro).
export async function listDeliveries(empreendimentoId?: string): Promise<Delivery[]> {
  let q = supabase.from("delivery_inspections").select("data").order("created_at", { ascending: false });
  if (empreendimentoId) q = q.eq("empreendimento_id", empreendimentoId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => row.data as unknown as Delivery);
}

export async function readDelivery(id: string): Promise<Delivery> {
  return (await readDeliveryComVinculo(id)).delivery;
}

export async function readDeliveryComVinculo(id: string): Promise<{ delivery: Delivery; vinculo: VinculoVistoria }> {
  const { data, error } = await supabase
    .from("delivery_inspections")
    .select("data, empreendimento_id, local_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    delivery: data.data as unknown as Delivery,
    vinculo: { empreendimentoId: data.empreendimento_id, localId: data.local_id },
  };
}

export async function saveDelivery(d: Delivery, vinculo: VinculoVistoria) {
  const { error } = await supabase.from("delivery_inspections").upsert(
    {
      id: d.id,
      data: d as unknown as Json,
      empreendimento_id: vinculo.empreendimentoId,
      local_id: vinculo.localId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function removeDelivery(id: string) {
  const { error } = await supabase.from("delivery_inspections").delete().eq("id", id);
  if (error) throw error;
}
