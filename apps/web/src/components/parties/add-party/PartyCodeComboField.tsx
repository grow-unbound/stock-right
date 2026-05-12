"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartyCodePickRow } from "@stockright/shared/api";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { PartyCodePickList } from "./PartyCodePickList";
import { PartyCodeSearchOverlay } from "./PartyCodeSearchOverlay";
import { usePartyCodeQuickPick } from "./usePartyCodeQuickPick";

interface PartyCodeComboFieldProps {
  labelClassName: string;
  warehouseId: string;
  supabase: SupabaseClient;
  code: string;
  onCodeChange: (next: string) => void;
  onPickRow: (row: PartyCodePickRow) => void;
  placeholder?: string;
}

export function PartyCodeComboField({
  labelClassName,
  warehouseId,
  supabase,
  code,
  onCodeChange,
  onPickRow,
  placeholder = "Short code or search",
}: PartyCodeComboFieldProps) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>();
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const { rows, loading } = usePartyCodeQuickPick({
    warehouseId,
    supabase,
    enabled: isDesktop && popoverOpen,
    q: query,
  });

  useLayoutEffect(() => {
    if (!popoverOpen || !anchorRef.current) return;
    setPopoverWidth(anchorRef.current.getBoundingClientRect().width);
  }, [popoverOpen]);

  const completePick = (row: PartyCodePickRow) => {
    onPickRow(row);
    setQuery(row.customer_code);
    setPopoverOpen(false);
    setOverlayOpen(false);
  };

  if (!isDesktop) {
    return (
      <div>
        <label htmlFor="add-party-code" className={labelClassName}>
          Party code
        </label>
        <div className="mt-1 flex w-full gap-2">
          <input
            id="add-party-code"
            type="text"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[48px] min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
          />
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            aria-label="Search existing party codes"
            onClick={() => setOverlayOpen(true)}
          >
            <ChevronDown className="size-5 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <PartyCodeSearchOverlay
          open={overlayOpen}
          warehouseId={warehouseId}
          supabase={supabase}
          onClose={() => setOverlayOpen(false)}
          onSelect={(row) => completePick(row)}
        />
      </div>
    );
  }

  const displayValue = popoverOpen ? query : code;

  return (
    <div>
      <label htmlFor="add-party-code" className={labelClassName}>
        Party code
      </label>
      <Popover
        open={popoverOpen}
        onOpenChange={(next) => {
          setPopoverOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverAnchor className="mt-1 block w-full">
          <div
            ref={anchorRef}
            className={cn(
              "flex min-h-[48px] w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3",
              "focus-within:border-[var(--brand-ui)] focus-within:ring-[3px] focus-within:ring-[rgba(200,113,42,0.12)]"
            )}
          >
            <Search className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <input
              id="add-party-code"
              type="text"
              role="combobox"
              autoCapitalize="characters"
              aria-expanded={popoverOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              value={displayValue}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                onCodeChange(v);
              }}
              onFocus={() => {
                setPopoverOpen(true);
                setQuery(code);
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
          className="z-[90] max-w-[min(480px,calc(100vw-24px))] p-0 shadow-[var(--shadow-3)]"
          style={popoverWidth !== undefined ? { width: popoverWidth } : undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <PartyCodePickList
            rows={rows}
            loading={loading}
            listboxId={listboxId}
            onSelect={(row) => completePick(row)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
