import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StockTabCacheAdapter } from "@stockright/shared/stock-tab";

export const mobileStockTabCacheAdapter: StockTabCacheAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
