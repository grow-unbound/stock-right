import type { AppCacheAdapter } from "@stockright/shared/offline/app-cache";

export const webMoneyAppCacheAdapter: AppCacheAdapter = {
  getItem: async (key) => (typeof window === "undefined" ? null : localStorage.getItem(key)),
  setItem: async (key, value) => {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof window !== "undefined") localStorage.removeItem(key);
  },
};
