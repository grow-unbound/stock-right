import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LandingFilterChip } from "../demo/landing-mock";

export const MONEY_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All" },
  { id: "receipt", label: "Receipts" },
  { id: "payment", label: "Payments" },
];

export const MoneySortColumnSchema = z.enum([
  "occurred_at",
  "created_at",
  "amount",
  "counterparty_name",
  "reference_number",
  "payment_method",
  "transaction_type",
]);

export type MoneySortColumn = z.infer<typeof MoneySortColumnSchema>;

export const MoneyMovementRowSchema = z.object({
  transaction_type: z.enum(["receipt", "payment"]),
  event_id: z.string().uuid(),
  occurred_at: z.string(),
  created_at: z.string(),
  amount: z.number(),
  payment_method: z.string().nullable(),
  counterparty_name: z.string(),
  customer_code: z.string().nullable(),
  reference_number: z.string().nullable(),
  payment_type_name: z.string().nullable(),
  receipt_allocated: z.boolean().nullable(),
});

export type MoneyMovementRow = z.infer<typeof MoneyMovementRowSchema>;

export interface MoneyMonthTotals {
  receivedRupees: number;
  paidRupees: number;
  receiptCount: number;
  paymentCount: number;
}

export function parseMoneyMovementRows(rows: unknown): MoneyMovementRow[] {
  return z.array(MoneyMovementRowSchema).parse(rows);
}

export async function countMoneyMovements(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    search: string;
    transactionType: "all" | "receipt" | "payment";
  }
): Promise<number> {
  const typeArg =
    params.transactionType === "all" ? null : params.transactionType === "receipt" ? "receipt" : "payment";

  const { data, error } = await client.rpc("count_money_movements", {
    p_warehouse_id: params.warehouseId,
    p_search: params.search.trim() === "" ? null : params.search.trim(),
    p_transaction_type: typeArg,
  });

  if (error) throw error;
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function listMoneyMovements(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    search: string;
    transactionType: "all" | "receipt" | "payment";
    sortColumn: MoneySortColumn;
    sortDirection: "asc" | "desc";
    page: number;
    pageSize: number;
  }
): Promise<MoneyMovementRow[]> {
  const typeArg =
    params.transactionType === "all" ? null : params.transactionType === "receipt" ? "receipt" : "payment";

  const { data, error } = await client.rpc("list_money_movements", {
    p_warehouse_id: params.warehouseId,
    p_search: params.search.trim() === "" ? null : params.search.trim(),
    p_transaction_type: typeArg,
    p_sort_column: params.sortColumn,
    p_sort_direction: params.sortDirection,
    p_page: params.page,
    p_page_size: params.pageSize,
  });

  if (error) throw error;
  return parseMoneyMovementRows(data ?? []);
}

export async function fetchMoneyMonthTotals(
  client: SupabaseClient,
  warehouseId: string,
  range: { startIsoDate: string; endIsoDate: string }
): Promise<MoneyMonthTotals> {
  const { data, error } = await client
    .from("daily_money_summary")
    .select("receipts_amount, receipts_count, payments_amount, payments_count")
    .eq("warehouse_id", warehouseId)
    .gte("summary_date", range.startIsoDate)
    .lte("summary_date", range.endIsoDate);

  if (error) throw error;

  let receivedRupees = 0;
  let paidRupees = 0;
  let receiptCount = 0;
  let paymentCount = 0;

  for (const row of data ?? []) {
    receivedRupees += Number(row.receipts_amount ?? 0);
    paidRupees += Number(row.payments_amount ?? 0);
    receiptCount += Number(row.receipts_count ?? 0);
    paymentCount += Number(row.payments_count ?? 0);
  }

  return { receivedRupees, paidRupees, receiptCount, paymentCount };
}

export function calendarMonthRangeLocal(year: number, monthIndex0: number): { startIsoDate: string; endIsoDate: string } {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIsoDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endIsoDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { startIsoDate, endIsoDate };
}

export function displayMoneyReference(row: MoneyMovementRow): string {
  const raw = row.reference_number?.trim();
  if (raw) return raw;
  const short = row.event_id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return row.transaction_type === "receipt" ? `RCP-${short}` : `PAY-${short}`;
}
