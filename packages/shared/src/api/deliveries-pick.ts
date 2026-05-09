import type { SupabaseClient } from "@supabase/supabase-js";

export interface DeliveryPickRow {
  delivery_id: string;
  delivery_date: string;
  num_bags_out: number;
  status: string;
}

export async function listDeliveriesForLot(
  client: SupabaseClient,
  params: { lotId: string }
): Promise<DeliveryPickRow[]> {
  const { data, error } = await client
    .from("deliveries")
    .select("id, delivery_date, num_bags_out, status")
    .eq("lot_id", params.lotId)
    .order("delivery_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    delivery_id: row.id,
    delivery_date: row.delivery_date,
    num_bags_out: row.num_bags_out,
    status: row.status,
  }));
}
