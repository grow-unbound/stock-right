import { z } from "zod";

export const partiesTabListRowSchema = z.object({
  customer_id: z.string().uuid(),
  customer_code: z.string(),
  customer_name: z.string(),
  address: z.string().nullable().transform((s) => s ?? ""),
  outstanding_total: z.coerce.number(),
  outstanding_rents: z.coerce.number(),
  outstanding_charges: z.coerce.number(),
  fresh_lot_count: z.coerce.number().int(),
  fresh_bag_count: z.coerce.number().int(),
  aging_lot_count: z.coerce.number().int(),
  aging_bag_count: z.coerce.number().int(),
  stale_lot_count: z.coerce.number().int(),
  stale_bag_count: z.coerce.number().int(),
  lots_active: z.coerce.number().int(),
  lots_stale: z.coerce.number().int(),
  lots_delivered: z.coerce.number().int(),
  bags_active_stale_delivered: z.coerce.number(),
});

export type PartiesTabListRow = z.infer<typeof partiesTabListRowSchema>;

export const partiesTabListRowsSchema = z.array(partiesTabListRowSchema);

export const partiesTabKpisRpcSchema = z.object({
  total_outstanding: z.coerce.number(),
  customers_with_outstanding: z.coerce.number(),
  stale_stock_bags: z.coerce.number(),
  parties_with_stale: z.coerce.number(),
});

export interface PartiesTabKpis {
  totalOutstanding: number;
  customersWithOutstanding: number;
  staleStockBags: number;
  partiesWithStale: number;
}

export const partiesTabCachePayloadSchema = z.object({
  baselineRows: partiesTabListRowsSchema,
  kpis: z
    .object({
      totalOutstanding: z.number(),
      customersWithOutstanding: z.number(),
      staleStockBags: z.number(),
      partiesWithStale: z.number(),
    })
    .nullable(),
  cachedAt: z.string(),
});

export type PartiesTabCachePayload = z.infer<typeof partiesTabCachePayloadSchema>;

export function partyRowKey(row: Pick<PartiesTabListRow, "customer_id">): string {
  return row.customer_id;
}
