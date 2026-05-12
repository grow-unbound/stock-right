import type { SupabaseClient } from "@supabase/supabase-js";

import type { PaymentMethodValue } from "../receipt";
import { insertOperationalPayment } from "./operational-payments";
import { requireProfileIdForRecording } from "./receipts";

export type RentalModeValue = "YEARLY" | "MONTHLY" | "BROUGHT_FORWARD";

export async function resolveRentalModeForLodgement(
  client: SupabaseClient,
  warehouseId: string,
  lodgementDateIso: string
): Promise<Exclude<RentalModeValue, "BROUGHT_FORWARD">> {
  const { data: ws, error: wsErr } = await client
    .from("warehouse_settings")
    .select("yearly_rent_cutoff_month, yearly_rent_cutoff_day")
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (wsErr) throw wsErr;

  const d = new Date(`${lodgementDateIso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid lodgement date.");
  }

  const year = d.getUTCFullYear();
  const month = ws?.yearly_rent_cutoff_month ?? 1;
  const day = ws?.yearly_rent_cutoff_day ?? 1;

  const { data: cutoffStr, error: rpcErr } = await client.rpc("rent_yearly_cutoff_in_year", {
    p_year: year,
    p_cut_month: month,
    p_cut_day: day,
  });

  if (rpcErr) throw rpcErr;

  const cutoff = cutoffStr
    ? new Date(`${String(cutoffStr).slice(0, 10)}T12:00:00.000Z`)
    : new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(cutoff.getTime())) {
    return "MONTHLY";
  }

  return d <= cutoff ? "YEARLY" : "MONTHLY";
}

async function computeNextLotX(client: SupabaseClient, warehouseId: string): Promise<number> {
  let max = 0;
  let from = 0;
  const page = 1000;

  while (true) {
    const { data, error } = await client
      .from("lots")
      .select("lot_number")
      .eq("warehouse_id", warehouseId)
      .range(from, from + page - 1);

    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      const part = r.lot_number.split("/")[0]?.trim() ?? "";
      const n = Number.parseInt(part, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    if (rows.length < page) break;
    from += page;
  }

  return max + 1;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function previewNextLotSequenceNumber(
  client: SupabaseClient,
  warehouseId: string
): Promise<number> {
  return computeNextLotX(client, warehouseId);
}

export async function previewNextLotNumber(
  client: SupabaseClient,
  warehouseId: string,
  lodgedBags: number
): Promise<string> {
  const bags = Math.floor(lodgedBags);
  if (!Number.isFinite(bags) || bags <= 0) {
    throw new Error("Enter bags to preview lot number.");
  }
  const nextX = await computeNextLotX(client, warehouseId);
  return `${nextX}/${bags}`;
}

export async function fetchPaymentTypeIdByCategory(
  client: SupabaseClient,
  tenantId: string,
  category: string
): Promise<string> {
  const { data, error } = await client
    .from("payment_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`No active payment type configured for ${category}.`);
  }
  return data.id;
}

export interface ProductChargeLineForLot {
  productChargeTypeId: string;
  chargesPerBag: number;
  /** Bags this charge line applies to (may differ per charge type). */
  numBags: number;
  paidNow: number;
}

export interface InsertLodgementLotParams {
  warehouseId: string;
  customerId: string;
  productId: string;
  numBags: number;
  lodgementDateIso: string;
  notes: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  chargeLines: ProductChargeLineForLot[];
  /** Required when any line has pay-now amount. */
  paymentMethod: PaymentMethodValue | null;
}

export async function insertLodgementLot(
  client: SupabaseClient,
  params: InsertLodgementLotParams
): Promise<{ lotId: string; lotNumber: string }> {
  const bags = Math.floor(params.numBags);
  if (!Number.isFinite(bags) || bags <= 0) {
    throw new Error("Number of bags must be a positive whole number.");
  }

  const anyPayNow = params.chargeLines.some((l) => roundMoney(Math.max(0, l.paidNow)) > 0);
  if (anyPayNow && !params.paymentMethod) {
    throw new Error("Choose a payment method for amounts paid now.");
  }

  await requireProfileIdForRecording(client);

  const { data: wh, error: whErr } = await client
    .from("warehouses")
    .select("tenant_id")
    .eq("id", params.warehouseId)
    .maybeSingle();

  if (whErr) throw whErr;
  if (!wh?.tenant_id) throw new Error("Warehouse not found or not accessible.");

  const stockMovementPaymentTypeId = anyPayNow
    ? await fetchPaymentTypeIdByCategory(client, wh.tenant_id, "STOCK_MOVEMENT")
    : null;

  const nextX = await computeNextLotX(client, params.warehouseId);
  const lotNumber = `${nextX}/${bags}`;

  const rentalMode = await resolveRentalModeForLodgement(client, params.warehouseId, params.lodgementDateIso);

  const { data: lotRow, error: lotErr } = await client
    .from("lots")
    .insert({
      warehouse_id: params.warehouseId,
      tenant_id: wh.tenant_id,
      customer_id: params.customerId,
      product_id: params.productId,
      lot_number: lotNumber,
      original_bags: bags,
      balance_bags: bags,
      lodgement_date: params.lodgementDateIso,
      rental_mode: rentalMode,
      status: "ACTIVE",
      notes: params.notes,
      driver_name: params.driverName,
      vehicle_number: params.vehicleNumber,
      location_ids: [],
    })
    .select("id")
    .single();

  if (lotErr) throw lotErr;
  const lotId = lotRow?.id;
  if (!lotId) throw new Error("Lot insert returned no id.");

  for (const line of params.chargeLines) {
    const nb = Math.floor(line.numBags);
    if (!Number.isFinite(nb) || nb < 0) {
      throw new Error("Each charge line needs a valid number of bags.");
    }

    const chargeAmount = roundMoney(line.chargesPerBag * nb);
    const paidRaw = roundMoney(Math.max(0, line.paidNow));
    const paid = Math.min(paidRaw, chargeAmount);

    if (chargeAmount <= 0 && paid <= 0) {
      continue;
    }
    if (chargeAmount <= 0 && paid > 0) {
      throw new Error("Pay now cannot apply when receivable is zero.");
    }
    if (paid > chargeAmount + 0.02) {
      throw new Error("Pay now cannot exceed receivable for a charge line.");
    }

    const { data: tcRow, error: tcErr } = await client
      .from("transaction_charges")
      .insert({
        lot_id: lotId,
        delivery_id: null,
        product_charge_type_id: line.productChargeTypeId,
        charge_amount: chargeAmount,
        num_bags: nb,
        charge_date: params.lodgementDateIso,
        legacy_amount_paid: null,
        is_paid: chargeAmount <= 0.01,
        paid_date: chargeAmount <= 0.01 ? params.lodgementDateIso : null,
      })
      .select("id")
      .single();

    if (tcErr) throw tcErr;
    const tcId = tcRow?.id;
    if (!tcId) throw new Error("Charge insert returned no id.");

    if (paid > 0 && params.paymentMethod && stockMovementPaymentTypeId) {
      await insertOperationalPayment(client, {
        warehouseId: params.warehouseId,
        paymentTypeId: stockMovementPaymentTypeId,
        paymentTypeCategory: "STOCK_MOVEMENT",
        status: "PAID",
        amount: paid,
        paymentMethod: params.paymentMethod,
        paymentDateIso: params.lodgementDateIso,
        dueDateIso: null,
        notes: null,
        partyName: null,
        partyPhone: null,
        lotId,
        deliveryId: null,
        chargePayLines: [{ transactionChargeId: tcId, amount: paid }],
      });
    } else if (chargeAmount > 0.01 && paid <= 0) {
      /* Unpaid receivable only — TC row already inserted. */
    }
  }

  return { lotId, lotNumber };
}

/** Load product charge rows for lot form (display name + rate). */
export async function fetchProductChargesForProduct(
  client: SupabaseClient,
  productId: string
): Promise<
  {
    productChargeTypeId: string;
    chargesPerBag: number;
    displayName: string;
    code: string;
  }[]
> {
  const { data, error } = await client
    .from("product_charges")
    .select("product_charge_type_id, charges_per_bag, charge_types!inner ( display_name, code )")
    .eq("product_id", productId);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const ct = row.charge_types as { display_name: string; code: string } | null;
    return {
      productChargeTypeId: row.product_charge_type_id as string,
      chargesPerBag: Number(row.charges_per_bag ?? 0),
      displayName: ct?.display_name ?? "",
      code: ct?.code ?? "",
    };
  });
}
