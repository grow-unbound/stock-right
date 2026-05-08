"use client";

import { useState } from "react";
import { Check, Hourglass } from "lucide-react";
import {
  DEMO_FAB_STOCK_ACTIONS,
  DEMO_STOCK_FILTER_CHIPS,
  DEMO_STOCK_LOTS,
  filterStockLots,
  formatRupeesPlain,
} from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { LandingFabActionSheet } from "@/components/dashboard/LandingFabActionSheet";
import { Button } from "@/components/ui/Button";

const STROKE = 2;

type DesktopStockSheet = "lot" | "delivery" | null;

export default function StockPage() {
  const initialChip = DEMO_STOCK_FILTER_CHIPS[0]?.id ?? "all";
  const [chip, setChip] = useState(initialChip);
  const [desktopSheet, setDesktopSheet] = useState<DesktopStockSheet>(null);
  const lots = filterStockLots(DEMO_STOCK_LOTS, chip);

  const addLot = DEMO_FAB_STOCK_ACTIONS[0];
  const addDelivery = DEMO_FAB_STOCK_ACTIONS[1];

  const desktopActions =
    addLot && addDelivery ? (
      <>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={() => setDesktopSheet("lot")}
        >
          {addLot.label}
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={() => setDesktopSheet("delivery")}
        >
          {addDelivery.label}
        </Button>
      </>
    ) : null;

  return (
    <DashboardPageShell
      title="Stock"
      searchPlaceholder="Search lots, commodities, godowns…"
      chips={DEMO_STOCK_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={setChip}
      desktopActions={desktopActions}
    >
      <div className="flex flex-col gap-2 px-0 pt-2">
        {lots.map((lot) => (
          <button
            key={lot.lot}
            type="button"
            className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-[var(--text-tertiary)]">
                {lot.lot}
              </span>
              <span className="block font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--text-primary)]">
                {lot.commodity} · {lot.godown}
              </span>
              <span className="block text-[12px] text-[var(--text-secondary)]">{lot.party}</span>
              <span className="inline-flex pt-2">
                {lot.status === "in_stock" ? (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--inward-border)] bg-[var(--inward-bg)] px-2 py-1 text-[11px] font-medium text-[var(--inward)]">
                    <Check className="size-3" strokeWidth={STROKE} />
                    In stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-1 text-[11px] font-medium text-[var(--pending)]">
                    <Hourglass className="size-3" strokeWidth={STROKE} />
                    Collection due
                  </span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-[family-name:var(--font-display)] text-[22px] font-bold tabular-nums text-[var(--text-primary)]">
                {formatRupeesPlain(lot.bags)}
              </span>
              <span className="block font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-tertiary)]">
                bags
              </span>
            </span>
          </button>
        ))}
      </div>

      {desktopSheet && addLot && addDelivery ? (
        <LandingFabActionSheet
          open
          title={desktopSheet === "lot" ? addLot.label : addDelivery.label}
          actions={desktopSheet === "lot" ? [addLot] : [addDelivery]}
          onClose={() => setDesktopSheet(null)}
        />
      ) : null}
    </DashboardPageShell>
  );
}
