"use client";

import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, Search, X } from "lucide-react";
import type { LandingFilterChip } from "@stockright/shared/demo";
import { FilterChipRow } from "./FilterChipRow";
import { cn } from "@/lib/utils";

interface DesktopListPaneChromeProps {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchAccessory?: ReactNode;
  chips: LandingFilterChip[];
  chipActiveId: string;
  onChipChange: (id: string) => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  detailsToggleLabelOpen?: string;
  detailsToggleLabelClose?: string;
}

export function DesktopListPaneChrome({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchAccessory,
  chips,
  chipActiveId,
  onChipChange,
  detailsOpen,
  onToggleDetails,
  detailsToggleLabelOpen = "Show details panel",
  detailsToggleLabelClose = "Hide details panel",
}: DesktopListPaneChromeProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 bg-[var(--bg-page)] pb-2 pt-1">
      <div className="flex min-w-0 items-stretch gap-2 pb-2">
        <label
          className="flex min-h-12 min-w-0 flex-1 cursor-text items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 sm:min-h-10 sm:py-0"
          htmlFor="desktop-list-pane-search"
        >
          <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          <input
            id="desktop-list-pane-search"
            type="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] sm:min-h-0"
          />
          {searchValue.trim() !== "" ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label="Clear search"
            >
              <X className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          {searchAccessory}
        </label>
        <button
          type="button"
          onClick={onToggleDetails}
          className={cn(
            "flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-transparent text-[var(--brand-text)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          )}
          aria-label={detailsOpen ? detailsToggleLabelClose : detailsToggleLabelOpen}
          aria-pressed={detailsOpen}
        >
          {detailsOpen ? (
            <PanelRightClose className="size-[22px]" strokeWidth={2} aria-hidden />
          ) : (
            <PanelRightOpen className="size-[22px]" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
      <div className="px-0">
        <FilterChipRow chips={chips} activeId={chipActiveId} onChange={onChipChange} />
      </div>
    </div>
  );
}
