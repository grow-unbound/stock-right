"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { searchLotsQuickPick, type LotPickRow } from "@stockright/shared/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { QUICK_PICK_PAGE_SIZE } from "./quick-pick-constants";

function mergeLotsById(a: LotPickRow[], b: LotPickRow[]): LotPickRow[] {
  const seen = new Set(a.map((r) => r.lot_id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.lot_id)) {
      seen.add(row.lot_id);
      out.push(row);
    }
  }
  return out;
}

export function useLotQuickPick(args: {
  warehouseId: string;
  supabase: SupabaseClient;
  enabled: boolean;
  /** When set with dispatchableOnly, scopes search to this party’s lots. */
  customerId: string | null;
  /** Active/stale lots with balance > 0 only (Add Delivery). */
  dispatchableOnly?: boolean;
}): {
  query: string;
  setQuery: (q: string) => void;
  rows: LotPickRow[];
  loading: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
} {
  const { warehouseId, supabase, enabled, customerId, dispatchableOnly = false } = args;
  const effectiveEnabled = Boolean(warehouseId) && enabled && (!dispatchableOnly || Boolean(customerId));

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [rows, setRows] = useState<LotPickRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      if (!warehouseId || !effectiveEnabled) return;
      if (dispatchableOnly && !customerId) return;
      setLoading(true);
      try {
        const { rows: batch, count } = await searchLotsQuickPick(supabase, {
          warehouseId,
          q: debounced,
          limit: QUICK_PICK_PAGE_SIZE,
          offset: nextOffset,
          ...(dispatchableOnly && customerId
            ? {
                customerId,
                statusIn: ["ACTIVE", "STALE"],
                positiveBalanceOnly: true,
              }
            : {}),
        });
        if (count !== null) setTotalCount(count);
        setRows((prev) => (reset ? batch : mergeLotsById(prev, batch)));
      } finally {
        setLoading(false);
      }
    },
    [debounced, supabase, warehouseId, effectiveEnabled, dispatchableOnly, customerId]
  );

  useEffect(() => {
    if (!effectiveEnabled) return;
    setRows([]);
    setTotalCount(null);
    void fetchPage(0, true);
  }, [effectiveEnabled, debounced, fetchPage]);

  const loadedCount = rows.length;
  const canLoadMore =
    totalCount !== null ? loadedCount < totalCount : rows.length === QUICK_PICK_PAGE_SIZE;

  useEffect(() => {
    if (!effectiveEnabled) return;
    const root = scrollRootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || loading || !canLoadMore) return;
        void fetchPage(loadedCount, false);
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [effectiveEnabled, loading, canLoadMore, loadedCount, fetchPage]);

  return { query, setQuery, rows, loading, scrollRootRef, sentinelRef };
}
