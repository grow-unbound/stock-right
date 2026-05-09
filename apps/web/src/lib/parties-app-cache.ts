import type { PartiesTabCacheAdapter } from "@stockright/shared/parties-tab";

export const webPartiesTabCacheAdapter: PartiesTabCacheAdapter = {
  getItem: async (key: string) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
};
