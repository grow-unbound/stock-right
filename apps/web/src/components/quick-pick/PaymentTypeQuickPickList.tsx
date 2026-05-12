"use client";

import type { PaymentTypePickRow } from "@stockright/shared/api";
import type { RefObject } from "react";
import { cn } from "@/lib/utils";

interface PaymentTypeQuickPickListProps {
  rows: PaymentTypePickRow[];
  loading: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  listboxId: string;
  onSelect: (row: PaymentTypePickRow) => void;
  density?: "overlay" | "popover";
}

export function PaymentTypeQuickPickList({
  rows,
  loading,
  scrollRootRef,
  sentinelRef,
  listboxId,
  onSelect,
  density = "overlay",
}: PaymentTypeQuickPickListProps) {
  const pad =
    density === "overlay"
      ? "min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2"
      : "max-h-[min(40vh,320px)] overflow-y-auto px-2 py-2";

  return (
    <div ref={scrollRootRef} id={listboxId} role="listbox" className={cn(pad)} aria-multiselectable={false}>
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
            <li key={r.id} role="presentation">
              <button
                type="button"
                role="option"
                className={cn(
                  "flex w-full min-h-[48px] flex-row items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3 text-left",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                )}
                onClick={() => onSelect(r)}
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
  );
}
