export interface ProductChargeLineShape {
  productChargeTypeId: string;
  code: string;
}

export function isChargeNumBagsLockedToLot(code: string): boolean {
  return code === "HAMALI" || code === "INSURANCE";
}

export function buildInitialNumBagsByLine(
  rows: ProductChargeLineShape[],
  lodgedBags: number
): Record<string, string> {
  const n = Math.max(0, Math.floor(lodgedBags));
  const o: Record<string, string> = {};
  for (const row of rows) {
    o[row.productChargeTypeId] =
      isChargeNumBagsLockedToLot(row.code) ? String(n) : "0";
  }
  return o;
}

export function syncLockedNumBagsToLotBags(
  prev: Record<string, string>,
  chargeRows: ProductChargeLineShape[],
  bagsNum: number
): Record<string, string> {
  const v = String(Math.max(0, Math.floor(bagsNum)));
  const next = { ...prev };
  let changed = false;
  for (const l of chargeRows) {
    if (!isChargeNumBagsLockedToLot(l.code)) continue;
    if (next[l.productChargeTypeId] !== v) {
      next[l.productChargeTypeId] = v;
      changed = true;
    }
  }
  return changed ? next : prev;
}
