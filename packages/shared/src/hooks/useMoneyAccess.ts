import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanManageMoney } from "../api/money-access";

export function useMoneyAccess(client: SupabaseClient | null): {
  canManageMoney: boolean;
  loaded: boolean;
  refresh: () => void;
} {
  const [canManageMoney, setCanManageMoney] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n: number) => n + 1);
  }, []);

  useEffect(() => {
    if (!client) {
      setCanManageMoney(false);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const ok = await fetchCanManageMoney(client);
        if (!cancelled) setCanManageMoney(ok);
      } catch {
        if (!cancelled) setCanManageMoney(false);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  return { canManageMoney, loaded, refresh };
}
