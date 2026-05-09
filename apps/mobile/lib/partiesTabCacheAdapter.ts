import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PartiesTabCacheAdapter } from "@stockright/shared/parties-tab";

export const mobilePartiesTabCacheAdapter: PartiesTabCacheAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
