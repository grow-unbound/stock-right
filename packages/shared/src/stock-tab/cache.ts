import { stockTabCachePayloadSchema, type StockTabCachePayload } from "./schemas";

export interface StockTabCacheAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function readStockTabCache(
  adapter: StockTabCacheAdapter,
  cacheKey: string
): Promise<StockTabCachePayload | null> {
  const raw = await adapter.getItem(cacheKey);
  if (raw === null) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = stockTabCachePayloadSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeStockTabCache(
  adapter: StockTabCacheAdapter,
  cacheKey: string,
  payload: Omit<StockTabCachePayload, "cachedAt"> & { cachedAt?: string }
): Promise<void> {
  const full: StockTabCachePayload = {
    ...payload,
    cachedAt: payload.cachedAt ?? new Date().toISOString(),
  };
  await adapter.setItem(cacheKey, JSON.stringify(full));
}
