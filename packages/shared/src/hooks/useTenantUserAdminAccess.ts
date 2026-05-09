import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanManageTenantUsers } from "../api/tenant-users";

export function useTenantUserAdminAccess(client: SupabaseClient | null): {
  canManageTenantUsers: boolean;
  loaded: boolean;
  refresh: () => void;
} {
  const [canManageTenantUsers, setCanManageTenantUsers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n: number) => n + 1);
  }, []);

  useEffect(() => {
    if (!client) {
      setCanManageTenantUsers(false);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const ok = await fetchCanManageTenantUsers(client);
        if (!cancelled) setCanManageTenantUsers(ok);
      } catch {
        if (!cancelled) setCanManageTenantUsers(false);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  return { canManageTenantUsers, loaded, refresh };
}
