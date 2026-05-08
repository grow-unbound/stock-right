import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppCacheAdapter } from "@stockright/shared/offline/app-cache";

export const mobileMoneyAppCacheAdapter: AppCacheAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
