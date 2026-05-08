import * as SecureStore from "expo-secure-store";

// Secure persistent storage (replaces sessionStorage from web)
export const storage = {
  async set(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async remove(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};
