"use client";

import type { LandingFilterChip } from "@stockright/shared/demo";
import { cn } from "@/lib/utils";

interface FilterChipRowProps {
  chips: LandingFilterChip[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterChipRow({ chips, activeId, onChange }: FilterChipRowProps) {
  return (
    <div
      role="tablist"
      aria-label="Filters"
      className="flex gap-2 overflow-x-auto pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((c) => {
        const selected = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(c.id)}
            className={cn(
              "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3.5 text-[13px] transition-colors duration-[var(--duration-fast)]",
              selected
                ? "border-[var(--brand-ui)] bg-[var(--brand-subtle)] font-semibold text-[var(--brand-text)]"
                : "border-[var(--border-default)] bg-[var(--bg-surface)] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            )}
          >
            <span>{c.label}</span>
            {c.count != null && (
              <span
                className={cn(
                  "font-[family-name:var(--font-mono)] text-[10px] opacity-70",
                  selected ? "text-[var(--brand-text)]" : "text-[var(--text-secondary)]"
                )}
              >
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
