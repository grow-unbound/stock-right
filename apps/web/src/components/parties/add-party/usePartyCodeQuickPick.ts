"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDistinctPartyCodesForWarehouse, type PartyCodePickRow } from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";

export function usePartyCodeQuickPick(args: {
  warehouseId: string;
  supabase: SupabaseClient;
  enabled: boolean;
  /** Filter query (debounced). */
  q: string;
}): { rows: PartyCodePickRow[]; loading: boolean } {
  const { warehouseId, supabase, enabled, q } = args;
  const debounced = useDebouncedValue(q.trim(), 320);
  const [rows, setRows] = useState<PartyCodePickRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !warehouseId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchDistinctPartyCodesForWarehouse(supabase, {
      warehouseId,
      q: debounced,
      limit: 120,
    })
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, enabled, supabase, warehouseId]);

  return { rows, loading };
}
