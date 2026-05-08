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
  amount: z.coerce.number(),
  payment_method: z.string().nullable(),
  counterparty_name: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  customer_code: z.string().nullable(),
  reference_number: z.string().nullable(),
  payment_type_name: z.string().nullable(),
  receipt_allocated: z.boolean().nullable(),
  expenditure_head: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  notes: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
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

function localCalendarIsoDateFromTimestamp(isoTimestamptz: string): string {
  const d = new Date(isoTimestamptz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Calendar day for KPI bucketing; aligns with money_activity (payment_date wins, else created_at local day). */
function operationalPaymentCalendarDay(row: {
  payment_date: string | null;
  created_at: string;
}): string {
  if (row.payment_date != null && String(row.payment_date).trim() !== "") {
    const s = String(row.payment_date);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  return localCalendarIsoDateFromTimestamp(row.created_at);
}

export async function fetchMoneyMonthTotals(
  client: SupabaseClient,
  warehouseId: string,
  range: { startIsoDate: string; endIsoDate: string }
): Promise<MoneyMonthTotals> {
  const [receiptRes, paymentRes] = await Promise.all([
    client
      .from("customer_receipts")
      .select("total_amount")
      .eq("warehouse_id", warehouseId)
      .gte("receipt_date", range.startIsoDate)
      .lte("receipt_date", range.endIsoDate),
    client
      .from("operational_payments")
      .select("amount, payment_date, created_at")
      .eq("warehouse_id", warehouseId)
      .eq("status", "PAID"),
  ]);

  if (receiptRes.error) throw receiptRes.error;
  if (paymentRes.error) throw paymentRes.error;

  let receivedRupees = 0;
  for (const row of receiptRes.data ?? []) {
    receivedRupees += Number(row.total_amount ?? 0);
  }
  const receiptCount = receiptRes.data?.length ?? 0;

  let paidRupees = 0;
  let paymentCount = 0;
  for (const row of paymentRes.data ?? []) {
    const day = operationalPaymentCalendarDay(row);
    if (day >= range.startIsoDate && day <= range.endIsoDate) {
      paidRupees += Number(row.amount ?? 0);
      paymentCount += 1;
    }
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
