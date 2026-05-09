"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchPaymentTypesQuickPick, type PaymentTypePickRow } from "@stockright/shared/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { cn } from "@/lib/utils";
import { FORM_DRAWER_PANEL_WIDTH_CLASS } from "@/components/money/add-receipt/form-drawer-classes";

const PAGE_SIZE = 25;

interface PaymentTypeSearchOverlayProps {
  open: boolean;
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSelect: (row: PaymentTypePickRow) => void;
}

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

export function PaymentTypeSearchOverlay({
  open,
  warehouseId,
  supabase,
  onClose,
  onSelect,
}: PaymentTypeSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [rows, setRows] = useState<PaymentTypePickRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<PaymentTypePickRow[] | null>(null);

  const fetchPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      if (!warehouseId) return;
      setLoading(true);
      try {
        const { rows: batch, count } = await searchPaymentTypesQuickPick(supabase, {
          warehouseId,
          q: debounced,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        if (count !== null) setTotalCount(count);
        setRows((prev) => (reset ? batch : mergeById(prev, batch)));
        if (reset && debounced === "" && batch.length > 0) {
          cacheRef.current = batch;
        }
      } finally {
        setLoading(false);
      }
    },
    [debounced, supabase, warehouseId]
  );

  useEffect(() => {
    if (!open) return;
    if (debounced === "" && cacheRef.current && cacheRef.current.length > 0) {
      setRows(cacheRef.current);
    } else {
      setRows([]);
    }
    setTotalCount(null);
    void fetchPage(0, true);
  }, [open, debounced, fetchPage]);

  const loadedCount = rows.length;
  const canLoadMore = totalCount !== null ? loadedCount < totalCount : rows.length === PAGE_SIZE;

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
      aria-labelledby="payment-type-search-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3">
        <h2
          id="payment-type-search-title"
          className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]"
        >
          Payment type
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
            placeholder="Search payment types…"
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
              <li key={i} className="h-[72px] skeleton rounded-[var(--radius-md)]" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-[15px] text-[var(--text-secondary)]">
            No payment types match. Try a different search.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id}>
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
                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                      {r.name}
                    </span>
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-secondary)]">
                      {r.category}
                    </span>
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
