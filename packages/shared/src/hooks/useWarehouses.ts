import { useState, useCallback } from "react";
import { listWarehouses } from "../api/warehouse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Warehouse } from "../types/models";

export function useWarehouses(client: SupabaseClient, userId: string | null) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listWarehouses(client, userId);
      setWarehouses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load warehouses");
    } finally {
      setIsLoading(false);
    }
  }, [client, userId]);

  return { warehouses, isLoading, error, load };
}
