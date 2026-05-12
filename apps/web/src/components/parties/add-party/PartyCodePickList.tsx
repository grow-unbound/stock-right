"use client";

import type { PartyCodePickRow } from "@stockright/shared/api";
import { cn } from "@/lib/utils";

interface PartyCodePickListProps {
  rows: PartyCodePickRow[];
  loading: boolean;
  listboxId: string;
  onSelect: (row: PartyCodePickRow) => void;
  emptyHint?: string;
}

export function PartyCodePickList({
  rows,
  loading,
  listboxId,
  onSelect,
  emptyHint = "Type to search or add a new code.",
}: PartyCodePickListProps) {
  return (
    <div
      id={listboxId}
      role="listbox"
      className="max-h-[min(360px,50vh)] overflow-y-auto py-1"
      aria-busy={loading}
    >
      {loading && rows.length === 0 ? (
        <p className="px-3 py-4 text-[14px] text-[var(--text-tertiary)]">Loading…</p>
      ) : null}
      {!loading && rows.length === 0 ? (
        <p className="px-3 py-4 text-[14px] text-[var(--text-tertiary)]">{emptyHint}</p>
      ) : null}
      {rows.map((row) => (
        <button
          key={row.customer_code}
          type="button"
          role="option"
          className={cn(
            "flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left",
            "min-h-[48px] hover:bg-[var(--bg-subtle)] focus-visible:bg-[var(--bg-subtle)] focus-visible:outline-none"
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(row)}
        >
          <span className="font-mono text-[15px] font-semibold text-[var(--text-primary)]">{row.customer_code}</span>
          {row.phoneInconsistent ? (
            <span className="text-[13px] text-[var(--outward)]">Conflicting numbers on file</span>
          ) : row.phone ? (
            <span className="text-[13px] text-[var(--text-secondary)]">{row.phone}</span>
          ) : (
            <span className="text-[13px] text-[var(--text-tertiary)]">No primary phone on file</span>
          )}
        </button>
      ))}
    </div>
  );
}
