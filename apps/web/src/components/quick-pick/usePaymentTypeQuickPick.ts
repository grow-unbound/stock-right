"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { searchPaymentTypesQuickPick, type PaymentTypePickRow } from "@stockright/shared/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { QUICK_PICK_PAGE_SIZE } from "./quick-pick-constants";

function mergeById(a: PaymentTypePickRow[], b: PaymentTypePickRow[]): PaymentTypePickRow[] {
  const seen = new Set(a.map((r) => r.id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

export function usePaymentTypeQuickPick(args: {
  warehouseId: string;
  supabase: SupabaseClient;
  enabled: boolean;
  excludeCategories?: readonly string[];
}): {
  query: string;
  setQuery: (q: string) => void;
  rows: PaymentTypePickRow[];
  loading: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
} {
  const { warehouseId, supabase, enabled, excludeCategories } = args;
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [rows, setRows] = useState<PaymentTypePickRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const emptySearchCacheRef = useRef<PaymentTypePickRow[] | null>(null);

  const fetchPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      if (!warehouseId) return;
      setLoading(true);
      try {
        const { rows: batch, count } = await searchPaymentTypesQuickPick(supabase, {
          warehouseId,
          q: debounced,
          limit: QUICK_PICK_PAGE_SIZE,
          offset: nextOffset,
          excludeCategories,
        });
        if (count !== null) setTotalCount(count);
        setRows((prev) => (reset ? batch : mergeById(prev, batch)));
        if (reset && debounced === "" && batch.length > 0) {
          emptySearchCacheRef.current = batch;
        }
      } finally {
        setLoading(false);
      }
    },
    [debounced, excludeCategories, supabase, warehouseId]
  );

  useEffect(() => {
    if (!enabled) return;
    if (debounced === "" && emptySearchCacheRef.current && emptySearchCacheRef.current.length > 0) {
      setRows(emptySearchCacheRef.current);
    } else {
      setRows([]);
    }
    setTotalCount(null);
    void fetchPage(0, true);
  }, [enabled, debounced, fetchPage]);

  const loadedCount = rows.length;
  const canLoadMore =
    totalCount !== null ? loadedCount < totalCount : rows.length === QUICK_PICK_PAGE_SIZE;

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, loading, canLoadMore, loadedCount, fetchPage]);

  return { query, setQuery, rows, loading, scrollRootRef, sentinelRef };
}
