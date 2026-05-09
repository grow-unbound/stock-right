"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listDeliveriesForLot, type DeliveryPickRow } from "@stockright/shared/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { FORM_DRAWER_PANEL_WIDTH_CLASS } from "@/components/money/add-receipt/form-drawer-classes";

interface DeliveryListOverlayProps {
  open: boolean;
  lotId: string | null;
  supabase: SupabaseClient;
  onClose: () => void;
  onSelect: (row: DeliveryPickRow) => void;
}

export function DeliveryListOverlay({
  open,
  lotId,
  supabase,
  onClose,
  onSelect,
}: DeliveryListOverlayProps) {
  const [rows, setRows] = useState<DeliveryPickRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !lotId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await listDeliveriesForLot(supabase, { lotId });
        if (!cancelled) setRows(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lotId, supabase]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex flex-col bg-[var(--bg-page)] sm:left-auto sm:right-0 sm:top-0 sm:border-l sm:border-[var(--border-default)] sm:bg-[var(--bg-surface)] sm:shadow-[var(--shadow-3)]",
        FORM_DRAWER_PANEL_WIDTH_CLASS
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-list-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3">
        <h2
          id="delivery-list-title"
          className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]"
        >
          Choose delivery
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
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
        {!lotId ? (
          <p className="px-2 py-8 text-center text-[15px] text-[var(--text-secondary)]">Select a lot first.</p>
        ) : loading ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-[64px] skeleton rounded-[var(--radius-md)]" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-[15px] text-[var(--text-secondary)]">
            No deliveries for this lot.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.delivery_id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-[48px] flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3 text-left",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                  )}
                  onClick={() => {
                    onSelect(r);
                    onClose();
                  }}
                >
                  <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    {r.delivery_date} · {r.num_bags_out} bags
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-tertiary)]">
                    {r.delivery_id.slice(0, 8)}…
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
