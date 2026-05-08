"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import type { LandingFilterChip } from "@stockright/shared/demo";
import { getLandingFabConfig } from "@stockright/shared/demo";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { FilterChipRow } from "./FilterChipRow";
import { LandingFabActionSheet } from "./LandingFabActionSheet";
import { OfflineBanner } from "./OfflineBanner";
import { useIsOffline } from "@/hooks/useIsOffline";
import { shouldHideMobileDashboardChrome } from "@/lib/form-chrome";
import { cn } from "@/lib/utils";

interface DashboardPageShellProps {
  title: string;
  searchPlaceholder: string;
  chips: LandingFilterChip[];
  chipActiveId: string;
  onChipChange: (id: string) => void;
  trailing?: ReactNode;
  /** Shown on desktop only, right-aligned next to the page title */
  desktopActions?: ReactNode;
  /** When false, mobile FAB for `/money` is hidden (Staff). */
  moneyFabEnabled?: boolean;
  /** Controlled search — when set with `onSearchChange`, renders a real input (16px). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Shown at the end of the search field row (e.g. search-in-flight spinner). */
  searchAccessory?: ReactNode;
  /** Mobile FAB on `/money`: receipt/new navigation etc. */
  moneyFabOnSelect?: (actionId: string) => void;
  children: ReactNode;
}

export function DashboardPageShell({
  title,
  searchPlaceholder,
  chips,
  chipActiveId,
  onChipChange,
  trailing,
  desktopActions,
  moneyFabEnabled = true,
  moneyFabOnSelect,
  searchValue,
  onSearchChange,
  searchAccessory,
  children,
}: DashboardPageShellProps) {
  const offline = useIsOffline();
  const pathname = usePathname();
  const fabConfig =
    shouldHideMobileDashboardChrome(pathname ?? "") ?
      null
    : getLandingFabConfig(pathname ?? "", { enableMoneyFab: moneyFabEnabled });
  const [fabOpen, setFabOpen] = useState(false);

  const searchControlled = typeof onSearchChange === "function";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {offline && <OfflineBanner queueCount={DEMO_PROFILE_USER.offlineQueuedCount} />}

      <div className="sticky top-0 z-10 shrink-0 bg-[var(--bg-page)] pt-2">
        <div className="flex w-full items-start gap-2 pb-2 sm:items-center sm:justify-between">
          <h1 className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-[22px] font-semibold leading-tight text-[var(--text-primary)]">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {desktopActions ? (
              <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">{desktopActions}</div>
            ) : null}
            {trailing}
          </div>
        </div>
        <div className="px-0 pb-2.5">
          <label
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 sm:min-h-10 sm:py-0",
              searchControlled ? "cursor-text" : null
            )}
            htmlFor={searchControlled ? "dashboard-page-search" : undefined}
          >
            <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            {searchControlled ? (
              <input
                id="dashboard-page-search"
                type="search"
                enterKeyHint="search"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] sm:min-h-0"
              />
            ) : (
              <span className="text-[16px] text-[var(--text-placeholder)]">{searchPlaceholder}</span>
            )}
            {searchControlled && (searchValue ?? "").trim() !== "" ? (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-label="Clear search"
              >
                <X className="size-[18px]" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            {searchAccessory}
          </label>
        </div>
        <div className="px-0">
          <FilterChipRow chips={chips} activeId={chipActiveId} onChange={onChipChange} />
        </div>
      </div>

      <div className="min-h-0 flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] sm:pb-6">{children}</div>

      {fabConfig && (
        <>
          <button
            type="button"
            className={cn(
              "fixed bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+16px)] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-[var(--brand-ui)] text-[var(--text-on-brand)] shadow-[var(--shadow-2)] transition-colors hover:bg-[var(--brand-ui-hover)] active:bg-[var(--brand-ui-press)] sm:hidden",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            )}
            aria-label={fabConfig.title}
            onClick={() => setFabOpen(true)}
          >
            <Plus className="size-[26px]" strokeWidth={2} />
          </button>
          <LandingFabActionSheet
            open={fabOpen}
            title={fabConfig.title}
            actions={fabConfig.actions}
            onClose={() => setFabOpen(false)}
            onSelect={(id) => moneyFabOnSelect?.(id)}
          />
        </>
      )}
    </div>
  );
}
