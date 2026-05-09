import { partiesTabCachePayloadSchema, type PartiesTabCachePayload } from "./schemas";

export interface PartiesTabCacheAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function readPartiesTabCache(
  adapter: PartiesTabCacheAdapter,
  cacheKey: string
): Promise<PartiesTabCachePayload | null> {
  const raw = await adapter.getItem(cacheKey);
  if (raw === null) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = partiesTabCachePayloadSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writePartiesTabCache(
  adapter: PartiesTabCacheAdapter,
  cacheKey: string,
  payload: Omit<PartiesTabCachePayload, "cachedAt"> & { cachedAt?: string }
): Promise<void> {
  const full: PartiesTabCachePayload = {
    ...payload,
    cachedAt: payload.cachedAt ?? new Date().toISOString(),
  };
  await adapter.setItem(cacheKey, JSON.stringify(full));
}
