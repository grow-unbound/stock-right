"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { LandingFilterChip } from "@stockright/shared/demo";
import { getLandingFabConfig } from "@stockright/shared/demo";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { FilterChipRow } from "./FilterChipRow";
import { LandingFabActionSheet } from "./LandingFabActionSheet";
import { OfflineBanner } from "./OfflineBanner";
import { useIsOffline } from "@/hooks/useIsOffline";
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
  children,
}: DashboardPageShellProps) {
  const offline = useIsOffline();
  const pathname = usePathname();
  const fabConfig = getLandingFabConfig(pathname ?? "");
  const [fabOpen, setFabOpen] = useState(false);

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
          <div
            className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3"
            role="search"
          >
            <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <span className="text-[16px] text-[var(--text-placeholder)]">{searchPlaceholder}</span>
          </div>
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
          />
        </>
      )}
    </div>
  );
}
