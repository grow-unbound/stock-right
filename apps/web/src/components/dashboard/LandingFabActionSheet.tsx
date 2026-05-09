"use client";

import type { LandingFabAction } from "@stockright/shared/demo";
import {
  Box,
  ChevronRight,
  Package,
  Receipt,
  Truck,
  User,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LandingFabActionSheetProps {
  open: boolean;
  title: string;
  actions: LandingFabAction[];
  onClose: () => void;
  onSelect?: (id: string) => void;
}

function toneClasses(tone: LandingFabAction["tone"]) {
  if (tone === "inward") return "bg-[var(--inward-bg)] text-[var(--inward)] border-[var(--inward-border)]";
  if (tone === "outward") return "bg-[var(--outward-bg)] text-[var(--outward)] border-[var(--outward-border)]";
  return "bg-[var(--brand-subtle)] text-[var(--brand-text)] border-[var(--border-default)]";
}

function ActionIcon({ id, tone }: { id: string; tone: LandingFabAction["tone"] }) {
  const cls = "size-[22px]";
  const stroke = 2;
  if (id === "add_lot") return <Box className={cls} strokeWidth={stroke} />;
  if (id === "add_delivery") return <Truck className={cls} strokeWidth={stroke} />;
  if (id === "add_party") return <User className={cls} strokeWidth={stroke} />;
  if (id === "add_receipt") return <Receipt className={cls} strokeWidth={stroke} />;
  if (id === "add_payment") return <Wallet className={cls} strokeWidth={stroke} />;
  return <Package className={cls} strokeWidth={stroke} />;
}

export function LandingFabActionSheet({
  open,
  title,
  actions,
  onClose,
  onSelect,
}: LandingFabActionSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fab-sheet-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay-scrim)] fab-sheet-backdrop-enter"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="fab-sheet-panel w-full max-w-lg rounded-t-[20px] bg-[var(--bg-surface)] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-3)] fab-sheet-panel-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fab-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--bg-inset)]" />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="fab-sheet-title" className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-[var(--radius-md)] p-1 text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                )}
                onClick={() => {
                  onSelect?.(a.id);
                  onClose();
                }}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-[10px] border",
                    toneClasses(a.tone)
                  )}
                >
                  <ActionIcon id={a.id} tone={a.tone} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[var(--text-primary)]">{a.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-secondary)]">{a.hint}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
