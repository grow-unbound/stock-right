/**
 * Customer row shape used by receipt party picker (`searchCustomersQuickPick`).
 * Distinct from `PartiesTabListRow` in `@stockright/shared/parties-tab` (full tab list).
 */
export interface PartiesTabRow {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  phone: string;
  mobile: string;
  address: string;
  outstanding: number;
  lot_count: number;
  bag_count: number;
  last_activity_date: string | null;
  has_stock: boolean;
  filter_total: number;
}

export type {
  PartiesTabListRow,
  PartiesTabKpis,
  PartiesTabFilterId,
  PartiesTabCachePayload,
} from "../parties-tab";

export {
  partiesTabCacheKey,
  fetchPartiesTabKpis,
  countPartiesTab,
  listPartiesTab,
} from "../parties-tab";
