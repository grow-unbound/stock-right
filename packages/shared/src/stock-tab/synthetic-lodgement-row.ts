import type { StockMovementRow } from "./schemas";

export function buildSyntheticLodgementRow(params: {
  lotId: string;
  lotNumber: string;
  lodgementDateIso: string;
  numBags: number;
  customerCode: string;
  customerName: string;
  productName: string;
}): StockMovementRow {
  return {
    transaction_type: "lodgement",
    event_id: params.lotId,
    lot_id: params.lotId,
    tx_date: params.lodgementDateIso,
    created_at: new Date().toISOString(),
    lot_number: params.lotNumber,
    num_bags: params.numBags,
    balance_bags: params.numBags,
    lot_status: "ACTIVE",
    customer_code: params.customerCode,
    customer_name: params.customerName,
    product_name: params.productName,
    rent_pending: 0,
    charges_pending: 0,
  };
}
