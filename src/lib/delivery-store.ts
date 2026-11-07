import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Delivery } from "./delivery";
export async function listDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("delivery_inspections")
    .select("data")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.data as unknown as Delivery);
}
export async function readDelivery(id: string): Promise<Delivery> {
  const { data, error } = await supabase
    .from("delivery_inspections")
    .select("data")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.data as unknown as Delivery;
}
export async function saveDelivery(d: Delivery) {
  const { error } = await supabase
    .from("delivery_inspections")
    .upsert(
      { id: d.id, data: d as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw error;
}
export async function removeDelivery(id: string) {
  const { error } = await supabase.from("delivery_inspections").delete().eq("id", id);
  if (error) throw error;
}
