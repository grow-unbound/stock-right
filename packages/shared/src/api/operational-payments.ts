import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PaymentMethodSchema } from "../receipt/schemas";
import { requireProfileIdForRecording } from "./receipts";

const OpPaymentStatusSchema = z.enum(["PENDING", "PAID"]);

export interface UnpaidChargeRow {
  id: string;
  chargeAmount: number;
  legacyAmountPaid: number;
  displayName: string;
  productChargeTypeId: string;
}

export async function fetchUnpaidChargesForLotDelivery(
  client: SupabaseClient,
  params: { lotId: string; deliveryId: string }
): Promise<UnpaidChargeRow[]> {
  const { data, error } = await client
    .from("transaction_charges")
    .select(
      "id, charge_amount, legacy_amount_paid, product_charge_type_id, product_charges!inner ( charge_types!inner ( display_name ) )"
    )
    .eq("lot_id", params.lotId)
    .eq("delivery_id", params.deliveryId)
    .eq("is_paid", false);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const pc = row.product_charges as { charge_types: { display_name: string } } | null;
    const dn = pc?.charge_types?.display_name ?? "";
    return {
      id: row.id as string,
      chargeAmount: Number(row.charge_amount ?? 0),
      legacyAmountPaid: Number(row.legacy_amount_paid ?? 0),
      displayName: dn,
      productChargeTypeId: row.product_charge_type_id as string,
    };
  });
}

const ChargePayLineSchema = z.object({
  transactionChargeId: z.string().uuid(),
  amount: z.number().min(0),
});

export const InsertOperationalPaymentInputSchema = z
  .object({
    warehouseId: z.string().uuid(),
    paymentTypeId: z.string().uuid().nullable(),
    paymentTypeCategory: z.string().nullable(),
    status: OpPaymentStatusSchema,
    amount: z.number().positive(),
    paymentMethod: PaymentMethodSchema,
    paymentDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    notes: z.string().max(4000).nullable(),
    partyName: z.string().max(500).nullable(),
    partyPhone: z.string().max(50).nullable(),
    lotId: z.string().uuid().nullable(),
    deliveryId: z.string().uuid().nullable(),
    chargePayLines: z.array(ChargePayLineSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "PENDING" && (val.dueDateIso === null || val.dueDateIso === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date required when status is pending." });
    }
  });

export type InsertOperationalPaymentInput = z.infer<typeof InsertOperationalPaymentInputSchema>;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function insertOperationalPayment(
  client: SupabaseClient,
  raw: InsertOperationalPaymentInput
): Promise<{ id: string }> {
  const params = InsertOperationalPaymentInputSchema.parse(raw);
  const recordedBy = await requireProfileIdForRecording(client);

  const { data: wh, error: whErr } = await client
    .from("warehouses")
    .select("tenant_id")
    .eq("id", params.warehouseId)
    .maybeSingle();

  if (whErr) throw whErr;
  if (!wh?.tenant_id) throw new Error("Warehouse not found or not accessible.");

  const isStockMovement = params.paymentTypeCategory === "STOCK_MOVEMENT";
  const lines = params.chargePayLines ?? [];

  if (isStockMovement && params.status === "PAID") {
    if (!params.lotId) {
      throw new Error("Lot is required for this payment type.");
    }
    const sumLines = roundMoney(lines.reduce((s, l) => s + l.amount, 0));
    if (Math.abs(sumLines - roundMoney(params.amount)) > 0.02) {
      throw new Error("Total payment must match the sum of charge lines.");
    }
    const paidLines = lines.filter((l) => l.amount > 0);
    if (paidLines.length === 0) {
      throw new Error("Enter at least one charge amount for this payment type.");
    }
  }

  const insertRow = {
    warehouse_id: params.warehouseId,
    tenant_id: wh.tenant_id,
    payment_type_id: params.paymentTypeId,
    status: params.status,
    amount: roundMoney(params.amount),
    payment_method: params.paymentMethod,
    payment_date: params.status === "PAID" ? params.paymentDateIso : null,
    due_date: params.status === "PENDING" ? params.dueDateIso : null,
    notes: params.notes,
    party_name: params.partyName,
    party_phone: params.partyPhone,
    lot_id: isStockMovement ? params.lotId : null,
    delivery_id: isStockMovement && params.deliveryId ? params.deliveryId : null,
    recorded_by: recordedBy,
  };

  const { data, error } = await client.from("operational_payments").insert(insertRow).select("id").single();

  if (error) throw error;
  if (!data?.id) throw new Error("Payment insert returned no id.");

  if (isStockMovement && params.status === "PAID" && params.lotId) {
    for (const line of lines) {
      if (line.amount <= 0) continue;
      let tcQuery = client
        .from("transaction_charges")
        .select("id, charge_amount, legacy_amount_paid, is_paid")
        .eq("id", line.transactionChargeId)
        .eq("lot_id", params.lotId);
      tcQuery = params.deliveryId ? tcQuery.eq("delivery_id", params.deliveryId) : tcQuery.is("delivery_id", null);
      const { data: tc, error: tcErr } = await tcQuery.maybeSingle();

      if (tcErr) throw tcErr;
      if (!tc) throw new Error("Charge line not found.");
      if (tc.is_paid) throw new Error("A selected charge is already paid.");

      const prior = Number(tc.legacy_amount_paid ?? 0);
      const cap = Number(tc.charge_amount ?? 0);
      const nextPaid = roundMoney(prior + line.amount);
      if (nextPaid > cap + 0.02) {
        throw new Error("Payment exceeds remaining amount for a charge line.");
      }
      const fullyPaid = nextPaid >= cap - 0.01;
      const { error: upErr } = await client
        .from("transaction_charges")
        .update({
          legacy_amount_paid: nextPaid,
          is_paid: fullyPaid,
          paid_date: fullyPaid ? params.paymentDateIso : null,
        })
        .eq("id", line.transactionChargeId);

      if (upErr) throw upErr;
    }
  }

  return { id: data.id };
}
