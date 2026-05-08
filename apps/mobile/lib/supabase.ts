import { createClient } from "@supabase/supabase-js";

// Singleton Supabase client for mobile — session persisted via expo-secure-store
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
