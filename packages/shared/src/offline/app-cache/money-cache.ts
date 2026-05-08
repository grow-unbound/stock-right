import { parseMoneyMovementRows, type MoneyMovementRow } from "../../api/money";
import type { AppCacheAdapter } from "./types";

const SNAPSHOT_VERSION = 1 as const;

export interface MoneyListSnapshotV1 {
  v: typeof SNAPSHOT_VERSION;
  updatedAt: string;
  rows: MoneyMovementRow[];
}

export function moneyListStorageKey(warehouseId: string, chip: string): string {
  return `sr.money.list.v${SNAPSHOT_VERSION}.${warehouseId}.${chip}`;
}

export function moneyPendingStorageKey(warehouseId: string): string {
  return `sr.money.pending.v${SNAPSHOT_VERSION}.${warehouseId}`;
}

export async function loadMoneyListSnapshot(
  adapter: AppCacheAdapter,
  warehouseId: string,
  chip: string
): Promise<MoneyMovementRow[]> {
  const raw = await adapter.getItem(moneyListStorageKey(warehouseId, chip));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<MoneyListSnapshotV1>;
    if (parsed.v !== SNAPSHOT_VERSION || !Array.isArray(parsed.rows)) return [];
    return parseMoneyMovementRows(parsed.rows);
  } catch {
    return [];
  }
}

export async function saveMoneyListSnapshot(
  adapter: AppCacheAdapter,
  warehouseId: string,
  chip: string,
  rows: MoneyMovementRow[]
): Promise<void> {
  const payload: MoneyListSnapshotV1 = {
    v: SNAPSHOT_VERSION,
    updatedAt: new Date().toISOString(),
    rows,
  };
  await adapter.setItem(moneyListStorageKey(warehouseId, chip), JSON.stringify(payload));
}

export async function loadMoneyPendingRows(adapter: AppCacheAdapter, warehouseId: string): Promise<MoneyMovementRow[]> {
  const raw = await adapter.getItem(moneyPendingStorageKey(warehouseId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { v?: number; items?: unknown };
    if (parsed.v !== SNAPSHOT_VERSION || !Array.isArray(parsed.items)) return [];
    return parseMoneyMovementRows(parsed.items);
  } catch {
    return [];
  }
}

export async function saveMoneyPendingRows(
  adapter: AppCacheAdapter,
  warehouseId: string,
  rows: MoneyMovementRow[]
): Promise<void> {
  const payload = { v: SNAPSHOT_VERSION, items: rows };
  await adapter.setItem(moneyPendingStorageKey(warehouseId), JSON.stringify(payload));
}
