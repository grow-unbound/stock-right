"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartiesTabRow } from "@stockright/shared/api";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { CustomerSearchOverlay } from "@/components/money/add-receipt/CustomerSearchOverlay";
import { CustomerQuickPickList } from "./CustomerQuickPickList";
import { useCustomerQuickPick } from "./useCustomerQuickPick";

interface PartyQuickPickFieldProps {
  label: string;
  labelClassName: string;
  warehouseId: string;
  supabase: SupabaseClient;
  value: PartiesTabRow | null;
  onChange: (row: PartiesTabRow) => void;
  placeholder?: string;
}

export function PartyQuickPickField({
  label,
  labelClassName,
  warehouseId,
  supabase,
  value,
  onChange,
  placeholder = "Search parties…",
}: PartyQuickPickFieldProps) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { query, setQuery, rows, loading, scrollRootRef, sentinelRef } = useCustomerQuickPick({
    warehouseId,
    supabase,
    enabled: isDesktop && popoverOpen,
  });

  const handlePopoverOpenChange = (next: boolean) => {
    setPopoverOpen(next);
    if (!next) setQuery("");
  };

  useLayoutEffect(() => {
    if (!popoverOpen || !anchorRef.current) return;
    const el = anchorRef.current;
    const sync = () => setPopoverWidth(el.getBoundingClientRect().width);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [popoverOpen]);

  const committedLabel = value ? `${value.customer_name} (${value.customer_code})` : "";

  if (!isDesktop) {
    return (
      <div>
        <label className={labelClassName}>{label}</label>
        <button
          type="button"
          className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          onClick={() => setOverlayOpen(true)}
        >
          <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
            {value ? committedLabel : placeholder}
          </span>
          <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
        </button>
        <CustomerSearchOverlay
          open={overlayOpen}
          warehouseId={warehouseId}
          supabase={supabase}
          onClose={() => setOverlayOpen(false)}
          onSelect={(row) => {
            onChange(row);
            setOverlayOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverAnchor className="block w-full">
          <div
            ref={anchorRef}
            className={cn(
              "flex min-h-[48px] w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3",
              "focus-within:border-[var(--brand-ui)] focus-within:ring-[3px] focus-within:ring-[rgba(200,113,42,0.12)]"
            )}
          >
            <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <input
              type="text"
              role="combobox"
              aria-expanded={popoverOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              value={popoverOpen ? query : committedLabel}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setPopoverOpen(true);
                setQuery("");
              }}
              placeholder={placeholder}
              className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-[90] max-w-[calc(100vw-24px)] p-0 shadow-[var(--shadow-3)]"
          style={popoverWidth !== undefined ? { width: popoverWidth } : undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <CustomerQuickPickList
            rows={rows}
            loading={loading}
            scrollRootRef={scrollRootRef}
            sentinelRef={sentinelRef}
            listboxId={listboxId}
            density="popover"
            onSelect={(row) => {
              onChange(row);
              handlePopoverOpenChange(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
