import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PaymentMethodSchema } from "../receipt/schemas";

const OutstandingRowSchema = z.object({
  line_kind: z.enum(["rent", "charge"]),
  line_id: z.string().uuid(),
  lot_id: z.string().uuid(),
  lot_number: z.string(),
  line_label: z.string(),
  display_period: z.string().nullable(),
  charge_type_code: z.string().nullable(),
  rental_mode: z.string().nullable(),
  sort_date: z.string(),
  due_amount: z.coerce.number(),
  remaining_amount: z.coerce.number(),
  product_name: z.string(),
  balance_bags: z.coerce.number(),
  original_bags: z.coerce.number(),
  lot_lodgement_date: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || v === "" ? "" : String(v))),
});

export type OutstandingAllocatableRow = z.infer<typeof OutstandingRowSchema>;

export async function fetchOutstandingAllocatable(
  client: SupabaseClient,
  warehouseId: string,
  customerId: string
): Promise<OutstandingAllocatableRow[]> {
  const { data, error } = await client.rpc("customer_outstanding_allocatable", {
    p_warehouse_id: warehouseId,
    p_customer_id: customerId,
  });

  if (error) throw error;
  return z.array(OutstandingRowSchema).parse(data ?? []);
}

export interface CustomerSummaryOutstanding {
  outstanding_charges: number;
  outstanding_rents: number;
}

export async function fetchCustomerOutstandingTotals(
  client: SupabaseClient,
  warehouseId: string,
  customerId: string
): Promise<CustomerSummaryOutstanding | null> {
  const { data, error } = await client
    .from("customer_summary")
    .select("outstanding_charges, outstanding_rents")
    .eq("warehouse_id", warehouseId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    outstanding_charges: Number(data.outstanding_charges ?? 0),
    outstanding_rents: Number(data.outstanding_rents ?? 0),
  };
}

export interface ConfirmAllocationInputLine {
  rent_accrual_id?: string;
  charge_id?: string;
  amount: number;
}

export async function requireProfileIdForRecording(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in required to record a receipt.");
  return user.id;
}

export async function insertCustomerReceipt(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    customerId: string;
    receiptDate: string;
    totalAmount: number;
    paymentMethod: string;
    notes?: string | null;
  }
): Promise<{ id: string }> {
  const paymentMethod = PaymentMethodSchema.parse(params.paymentMethod);

  const recordedBy = await requireProfileIdForRecording(client);

  const { data: wh, error: whErr } = await client
    .from("warehouses")
    .select("tenant_id")
    .eq("id", params.warehouseId)
    .maybeSingle();

  if (whErr) throw whErr;
  if (!wh) throw new Error("Warehouse not found or not accessible.");

  const totalAmount = Math.round(params.totalAmount * 100) / 100;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Receipt total must be a positive amount.");
  }

  const { data, error } = await client
    .from("customer_receipts")
    .insert({
      warehouse_id: params.warehouseId,
      customer_id: params.customerId,
      tenant_id: wh.tenant_id,
      receipt_date: params.receiptDate,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      notes: params.notes ?? null,
      recorded_by: recordedBy,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Receipt insert returned no id");
  return { id: data.id };
}

function parseTrailingNumberFromReference(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  const m = t.match(/(\d+)\s*$/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Next reference string from recent receipts in this warehouse (numeric increment). */
export async function suggestNextReceiptReference(
  client: SupabaseClient,
  warehouseId: string
): Promise<string> {
  const { data, error } = await client
    .from("customer_receipts")
    .select("reference_number")
    .eq("warehouse_id", warehouseId)
    .not("reference_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const ref = row.reference_number;
    if (typeof ref !== "string") continue;
    const n = parseTrailingNumberFromReference(ref);
    if (n !== null && n > max) max = n;
  }
  return String(max + 1);
}

export async function confirmReceiptAllocations(
  client: SupabaseClient,
  receiptId: string,
  lines: ConfirmAllocationInputLine[]
): Promise<{ receipt_id: string; applied_total: number; credit_remaining: number }> {
  const json = lines.map((l) => {
    if (l.rent_accrual_id) {
      return { rent_accrual_id: l.rent_accrual_id, amount: l.amount };
    }
    if (l.charge_id) {
      return { charge_id: l.charge_id, amount: l.amount };
    }
    throw new Error("Invalid allocation line");
  });

  const { data, error } = await client.rpc("confirm_receipt_allocations", {
    p_receipt_id: receiptId,
    p_lines: json,
  });

  if (error) throw error;

  const parsed = z
    .object({
      receipt_id: z.string().uuid(),
      applied_total: z.coerce.number(),
      credit_remaining: z.coerce.number(),
    })
    .parse(data);

  return {
    receipt_id: parsed.receipt_id,
    applied_total: parsed.applied_total,
    credit_remaining: parsed.credit_remaining,
  };
}

/** Insert receipt then finalize allocation (including `[]` for advance-only). */
export async function createReceiptWithAllocations(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    customerId: string;
    receiptDate: string;
    totalAmount: number;
    paymentMethod: string;
    notes?: string | null;
    allocationLines: ConfirmAllocationInputLine[];
  }
): Promise<{ receiptId: string; appliedTotal: number; creditRemaining: number }> {
  const { id } = await insertCustomerReceipt(client, {
    warehouseId: params.warehouseId,
    customerId: params.customerId,
    receiptDate: params.receiptDate,
    totalAmount: params.totalAmount,
    paymentMethod: params.paymentMethod,
    notes: params.notes,
  });

  const result = await confirmReceiptAllocations(client, id, params.allocationLines);
  return {
    receiptId: result.receipt_id,
    appliedTotal: result.applied_total,
    creditRemaining: result.credit_remaining,
  };
}
