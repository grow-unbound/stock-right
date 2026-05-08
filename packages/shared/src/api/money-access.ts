import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchCanManageMoney(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("user_can_manage_money");
  if (error) return false;
  return Boolean(data);
}
