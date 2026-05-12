import type { SupabaseClient } from "@supabase/supabase-js";

import type { PaymentMethodValue } from "../receipt";
import { fetchPaymentTypeIdByCategory, type ProductChargeLineForLot } from "./lots-create";
import { insertOperationalPayment } from "./operational-payments";
import { requireProfileIdForRecording } from "./receipts";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const DELIVERABLE_LOT_STATUSES = ["ACTIVE", "STALE"] as const;

export interface InsertDeliveryWithChargesParams {
  warehouseId: string;
  customerId: string;
  lotId: string;
  numBagsOut: number;
  deliveryDateIso: string;
  notes: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  chargeLines: ProductChargeLineForLot[];
  paymentMethod: PaymentMethodValue | null;
}

export interface InsertDeliveryWithChargesResult {
  deliveryId: string;
  lotId: string;
  lotNumber: string;
  balanceBagsAfter: number;
  lotStatus: string;
  customerCode: string;
  customerName: string;
  productName: string;
}

export async function insertDeliveryWithCharges(
  client: SupabaseClient,
  params: InsertDeliveryWithChargesParams
): Promise<InsertDeliveryWithChargesResult> {
  const numOut = Math.floor(params.numBagsOut);
  if (!Number.isFinite(numOut) || numOut <= 0) {
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

  const { data: lot, error: lotErr } = await client
    .from("lots")
    .select(
      "id, warehouse_id, customer_id, lot_number, balance_bags, status, customers!inner ( customer_code, customer_name ), products!inner ( product_name )"
    )
    .eq("id", params.lotId)
    .eq("warehouse_id", params.warehouseId)
    .maybeSingle();

  if (lotErr) throw lotErr;
  if (!lot?.id) throw new Error("Lot not found.");

  if (lot.customer_id !== params.customerId) {
    throw new Error("This lot belongs to a different party.");
  }

  const lotStatus = String(lot.status ?? "");
  if (!DELIVERABLE_LOT_STATUSES.includes(lotStatus as (typeof DELIVERABLE_LOT_STATUSES)[number])) {
    throw new Error("Only active or stale lots can be dispatched.");
  }

  const bal = Number(lot.balance_bags ?? 0);
  if (!Number.isFinite(bal) || numOut > bal) {
    throw new Error("Cannot dispatch more bags than the balance on this lot.");
  }

  function relOne<T extends Record<string, unknown>>(x: unknown): T | null {
    if (x == null) return null;
    if (Array.isArray(x)) return (x[0] as T | undefined) ?? null;
    return x as T;
  }

  const customers = relOne<{ customer_code: string; customer_name: string }>(lot.customers);
  const products = relOne<{ product_name: string }>(lot.products);

  const { data: delRow, error: delErr } = await client
    .from("deliveries")
    .insert({
      lot_id: params.lotId,
      num_bags_out: numOut,
      delivery_date: params.deliveryDateIso,
      notes: params.notes,
      driver_name: params.driverName,
      vehicle_number: params.vehicleNumber,
    })
    .select("id")
    .single();

  if (delErr) throw delErr;
  const deliveryId = delRow?.id;
  if (!deliveryId) throw new Error("Delivery insert returned no id.");

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
        lot_id: params.lotId,
        delivery_id: deliveryId,
        product_charge_type_id: line.productChargeTypeId,
        charge_amount: chargeAmount,
        num_bags: nb,
        charge_date: params.deliveryDateIso,
        legacy_amount_paid: null,
        is_paid: chargeAmount <= 0.01,
        paid_date: chargeAmount <= 0.01 ? params.deliveryDateIso : null,
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
        paymentDateIso: params.deliveryDateIso,
        dueDateIso: null,
        notes: null,
        partyName: null,
        partyPhone: null,
        lotId: params.lotId,
        deliveryId,
        chargePayLines: [{ transactionChargeId: tcId, amount: paid }],
      });
    }
  }

  const newBal = bal - numOut;
  const nextStatus = newBal <= 0 ? "DELIVERED" : lotStatus;

  const { error: upErr } = await client
    .from("lots")
    .update({
      balance_bags: newBal,
      status: nextStatus,
    })
    .eq("id", params.lotId);

  if (upErr) throw upErr;

  return {
    deliveryId,
    lotId: params.lotId,
    lotNumber: lot.lot_number as string,
    balanceBagsAfter: newBal,
    lotStatus: nextStatus,
    customerCode: customers?.customer_code ?? "",
    customerName: customers?.customer_name ?? "",
    productName: products?.product_name ?? "",
  };
}
