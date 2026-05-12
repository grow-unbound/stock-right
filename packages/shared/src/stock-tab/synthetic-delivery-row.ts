import type { StockMovementRow } from "./schemas";

export function buildSyntheticDeliveryRow(params: {
  deliveryId: string;
  lotId: string;
  lotNumber: string;
  deliveryDateIso: string;
  numBagsOut: number;
  balanceBagsAfter: number;
  lotStatus: string;
  customerCode: string;
  customerName: string;
  productName: string;
}): StockMovementRow {
  return {
    transaction_type: "delivery",
    event_id: params.deliveryId,
    lot_id: params.lotId,
    tx_date: params.deliveryDateIso,
    created_at: new Date().toISOString(),
    lot_number: params.lotNumber,
    num_bags: params.numBagsOut,
    balance_bags: params.balanceBagsAfter,
    lot_status: params.lotStatus,
    customer_code: params.customerCode,
    customer_name: params.customerName,
    product_name: params.productName,
    rent_pending: 0,
    charges_pending: 0,
  };
}
