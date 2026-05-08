"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_FAB_PARTIES_ACTIONS,
  DEMO_PARTIES_FILTER_CHIPS,
  DEMO_PARTIES_ROWS,
  filterParties,
} from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { LandingFabActionSheet } from "@/components/dashboard/LandingFabActionSheet";
import { Button } from "@/components/ui/Button";

const STROKE = 2;

type DesktopPartiesSheet = "party" | null;

export default function PartiesPage() {
  const initialChip = DEMO_PARTIES_FILTER_CHIPS[0]?.id ?? "all";
  const [chip, setChip] = useState(initialChip);
  const [desktopSheet, setDesktopSheet] = useState<DesktopPartiesSheet>(null);
  const rows = filterParties(DEMO_PARTIES_ROWS, chip);

  const addParty = DEMO_FAB_PARTIES_ACTIONS[0];

  const desktopActions = addParty ? (
    <Button
      variant="primary"
      size="sm"
      type="button"
      className="min-w-[var(--cta-tab-min-width)] justify-center"
      onClick={() => setDesktopSheet("party")}
    >
      {addParty.label}
    </Button>
  ) : null;

  return (
    <DashboardPageShell
      title="Parties"
      searchPlaceholder="Search by name or village…"
      chips={DEMO_PARTIES_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={setChip}
      desktopActions={desktopActions}
    >
      <div className="flex flex-col gap-2 px-0 pt-2">
        {rows.map((p) => (
          <button
            key={p.name}
            type="button"
            className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--font-display)] text-[17px] font-semibold leading-snug text-[var(--text-primary)]">
                {p.name}
              </span>
              <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
                {p.village} · {p.lots} {p.lots === 1 ? "lot" : "lots"}
              </span>
            </span>
            <span className="flex min-w-[88px] flex-col items-end">
              {p.balanceType === "due" && p.balanceRupee != null && (
                <>
                  <span className="font-[family-name:var(--font-display)] text-[18px] font-bold tabular-nums text-[var(--pending)]">
                    {formatIndianCurrency(p.balanceRupee)}
                  </span>
                  <span className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                    DUE
                  </span>
                </>
              )}
              {p.balanceType === "advance" && p.balanceRupee != null && (
                <>
                  <span className="font-[family-name:var(--font-display)] text-[18px] font-bold tabular-nums text-[var(--inward)]">
                    {formatIndianCurrency(p.balanceRupee)}
                  </span>
                  <span className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--inward)]">
                    ADVANCE
                  </span>
                </>
              )}
              {p.balanceType === "clear" && (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--inward-border)] bg-[var(--inward-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--inward)]">
                  <Check className="size-3" strokeWidth={STROKE} />
                  Clear
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {desktopSheet && addParty ? (
        <LandingFabActionSheet
          open
          title="Add party"
          actions={[addParty]}
          onClose={() => setDesktopSheet(null)}
        />
      ) : null}
    </DashboardPageShell>
  );
}
