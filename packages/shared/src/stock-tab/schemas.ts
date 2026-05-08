import { z } from "zod";

export const stockMovementRowSchema = z.object({
  transaction_type: z.enum(["lodgement", "delivery"]),
  event_id: z.string().uuid(),
  lot_id: z.string().uuid(),
  tx_date: z.string(),
  created_at: z.string(),
  lot_number: z.string(),
  num_bags: z.coerce.number(),
  balance_bags: z.coerce.number(),
  lot_status: z.string(),
  customer_code: z.string(),
  customer_name: z.string(),
  product_name: z.string(),
  rent_pending: z.coerce.number(),
  charges_pending: z.coerce.number(),
});

export type StockMovementRow = z.infer<typeof stockMovementRowSchema>;

export const stockMovementRowsSchema = z.array(stockMovementRowSchema);

export const stockSortColumnSchema = z.enum([
  "tx_date",
  "created_at",
  "lot_number",
  "transaction_type",
  "customer_code",
  "customer_name",
  "product_name",
  "num_bags",
  "balance_bags",
  "lot_status",
  "rent_pending",
  "charges_pending",
]);

export type StockSortColumn = z.infer<typeof stockSortColumnSchema>;

export const dailyStockSummaryKpiSchema = z.object({
  summary_date: z.string(),
  fresh_bags_eod: z.coerce.number(),
  fresh_lots_eod: z.coerce.number(),
  aging_bags_eod: z.coerce.number(),
  aging_lots_eod: z.coerce.number(),
  stale_bags_eod: z.coerce.number(),
  stale_lots_eod: z.coerce.number(),
});

export type DailyStockSummaryKpiRow = z.infer<typeof dailyStockSummaryKpiSchema>;

export interface StockTabKpis {
  activeStockBags: number;
  activeStockLots: number;
  staleStockBags: number;
  staleStockLots: number;
  summaryDate: string | null;
}

export const stockTabCachePayloadSchema = z.object({
  baselineMovements: stockMovementRowsSchema,
  kpis: z
    .object({
      activeStockBags: z.number(),
      activeStockLots: z.number(),
      staleStockBags: z.number(),
      staleStockLots: z.number(),
      summaryDate: z.string().nullable(),
    })
    .nullable(),
  cachedAt: z.string(),
});

export type StockTabCachePayload = z.infer<typeof stockTabCachePayloadSchema>;
