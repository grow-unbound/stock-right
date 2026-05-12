"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductPickRow } from "@stockright/shared/api";
import { cn } from "@/lib/utils";
import { ProductQuickPickList } from "@/components/quick-pick/ProductQuickPickList";
import { useProductQuickPick } from "@/components/quick-pick/useProductQuickPick";
import { FORM_DRAWER_PANEL_WIDTH_CLASS } from "@/components/money/add-receipt/form-drawer-classes";

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
  const listboxId = useId();
  const { query, setQuery, rows, loading, scrollRootRef, sentinelRef } = useProductQuickPick({
    warehouseId,
    supabase,
    enabled: open,
  });

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
            aria-controls={listboxId}
          />
        </label>
      </div>
      <ProductQuickPickList
        rows={rows}
        loading={loading}
        scrollRootRef={scrollRootRef}
        sentinelRef={sentinelRef}
        listboxId={listboxId}
        density="overlay"
        onSelect={(row) => {
          onSelect(row);
          onClose();
        }}
      />
    </div>
  );
}
