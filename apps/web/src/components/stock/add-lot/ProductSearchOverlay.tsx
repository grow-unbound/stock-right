"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchProductsQuickPick, type ProductPickRow } from "@stockright/shared/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { cn } from "@/lib/utils";
import { FORM_DRAWER_PANEL_WIDTH_CLASS } from "@/components/money/add-receipt/form-drawer-classes";

const PAGE_SIZE = 25;

interface ProductSearchOverlayProps {
  open: boolean;
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSelect: (row: ProductPickRow) => void;
}

export function ProductSearchOverlay({
  open,
  warehouseId,
  supabase,
  onClose,
  onSelect,
}: ProductSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [rows, setRows] = useState<ProductPickRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const emptySearchCacheRef = useRef<ProductPickRow[] | null>(null);

  const fetchPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      if (!warehouseId) return;
      setLoading(true);
      try {
        const { rows: batch, count } = await searchProductsQuickPick(supabase, {
          warehouseId,
          q: debounced,
          limit: PAGE_SIZE,
          offset: nextOffset,
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
    [debounced, supabase, warehouseId]
  );

  useEffect(() => {
    if (!open) return;
    if (debounced === "" && emptySearchCacheRef.current && emptySearchCacheRef.current.length > 0) {
      setRows(emptySearchCacheRef.current);
    } else {
      setRows([]);
    }
    setTotalCount(null);
    void fetchPage(0, true);
  }, [open, debounced, fetchPage]);

  const loadedCount = rows.length;
  const canLoadMore =
    totalCount !== null ? loadedCount < totalCount : rows.length === PAGE_SIZE;

  useEffect(() => {
    if (!open) return;
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
  }, [open, loading, canLoadMore, loadedCount, fetchPage]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex flex-col bg-[var(--bg-page)] sm:left-auto sm:right-0 sm:top-0 sm:border-l sm:border-[var(--border-default)] sm:bg-[var(--bg-surface)] sm:shadow-[var(--shadow-3)]",
        FORM_DRAWER_PANEL_WIDTH_CLASS
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-search-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3">
        <h2
          id="product-search-title"
          className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]"
        >
          Choose commodity
        </h2>
        <button
          type="button"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>
      <div className="border-b border-[var(--border-default)] px-3 py-2">
        <label className="flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3">
          <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
            autoFocus
          />
        </label>
      </div>
      <div
        ref={scrollRootRef}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2"
      >
        {loading && rows.length === 0 ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="h-[72px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]"
              />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-[15px] text-[var(--text-secondary)]">
            No commodities match. Try a different search.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.product_id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-[48px] flex-row items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3 text-left",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                  )}
                  onClick={() => {
                    onSelect(r);
                    onClose();
                  }}
                >
                  <span className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    {r.product_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
      </div>
    </div>
  );
}

function mergeById(a: ProductPickRow[], b: ProductPickRow[]): ProductPickRow[] {
  const seen = new Set(a.map((r) => r.product_id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.product_id)) {
      seen.add(row.product_id);
      out.push(row);
    }
  }
  return out;
}
