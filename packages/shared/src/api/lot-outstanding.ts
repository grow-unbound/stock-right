import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchOutstandingAllocatable } from "./receipts";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LotOutstandingTotals {
  chargesDue: number;
  rentsDue: number;
}

export async function fetchLotOutstandingTotals(
  client: SupabaseClient,
  warehouseId: string,
  customerId: string,
  lotId: string
): Promise<LotOutstandingTotals> {
  const rows = await fetchOutstandingAllocatable(client, warehouseId, customerId);
  let chargesDue = 0;
  let rentsDue = 0;
  for (const r of rows) {
    if (r.lot_id !== lotId) continue;
    if (r.line_kind === "charge") chargesDue += r.remaining_amount;
    else rentsDue += r.remaining_amount;
  }
  return { chargesDue: round2(chargesDue), rentsDue: round2(rentsDue) };
}
