import type { PartiesTabListRow } from "./schemas";

export function buildPlaceholderPartyListRow(params: {
  customerId: string;
  customerCode: string;
  customerName: string;
  address: string;
}): PartiesTabListRow {
  return {
    customer_id: params.customerId,
    customer_code: params.customerCode,
    customer_name: params.customerName,
    address: params.address,
    outstanding_total: 0,
    outstanding_rents: 0,
    outstanding_charges: 0,
    fresh_lot_count: 0,
    fresh_bag_count: 0,
    aging_lot_count: 0,
    aging_bag_count: 0,
    stale_lot_count: 0,
    stale_bag_count: 0,
    lots_active: 0,
    lots_stale: 0,
    lots_delivered: 0,
    bags_active_stale_delivered: 0,
  };
}
