import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Platform-agnostic Supabase client factory.
// Web uses createBrowserClient from @supabase/ssr (in apps/web/lib/supabase/).
// This factory is used by shared hooks and mobile.

let _client: SupabaseClient | null = null;

export function getSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

export function resetSupabaseClient(): void {
  _client = null;
}
