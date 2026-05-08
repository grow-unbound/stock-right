"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_HOME_COLLECTION_DUE_RUPEES,
  DEMO_HOME_FILTER_CHIPS,
  DEMO_HOME_KPIS,
  DEMO_HOME_RECENT_ENTRIES,
  DEMO_HOME_REGISTER_DATE,
  DEMO_PROFILE_USER,
  filterHomeRecent,
  formatRupeesPlain,
} from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { useSessionUser } from "@/components/session/session-user-provider";
import { cn } from "@/lib/utils";

const STROKE = 2;

export default function DashboardHomePage() {
  const { context } = useSessionUser();
  const initialChip = DEMO_HOME_FILTER_CHIPS[0]?.id ?? "today";
  const [chip, setChip] = useState(initialChip);
  const recent = filterHomeRecent(DEMO_HOME_RECENT_ENTRIES, chip).slice(0, 5);

  return (
    <DashboardPageShell
      title="Home"
      searchPlaceholder="Search lots, parties, commodities…"
      chips={DEMO_HOME_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={setChip}
      trailing={
        <Link
          href="/settings"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--brand-subtle)] font-[family-name:var(--font-display)] text-[14px] font-semibold text-[var(--brand-text)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
            "sm:hidden"
          )}
          aria-label="Open Preferences"
        >
          {context?.initials ?? DEMO_PROFILE_USER.initials}
        </Link>
      }
    >
      <div className="flex flex-col gap-4 px-0 pt-4">
        <div>
          <p className="text-[13px] text-[var(--text-secondary)]">{DEMO_HOME_REGISTER_DATE}</p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--text-primary)]">
            {"Today's register"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            label="Today inward"
            value={String(DEMO_HOME_KPIS.todayInwardBags)}
            sub={DEMO_HOME_KPIS.todayInwardSub}
            accentClass="text-[var(--inward)]"
          />
          <KpiCard
            label="Today outward"
            value={String(DEMO_HOME_KPIS.todayOutwardBags)}
            sub={DEMO_HOME_KPIS.todayOutwardSub}
            accentClass="text-[var(--outward)]"
          />
          <KpiCard
            label="Stock on hand"
            value={formatRupeesPlain(DEMO_HOME_KPIS.stockOnHandBags)}
            sub={DEMO_HOME_KPIS.stockOnHandSub}
            accentClass="text-[var(--text-primary)]"
          />
          <KpiCard
            label="Collection due"
            value={formatIndianCurrency(DEMO_HOME_COLLECTION_DUE_RUPEES)}
            sub={DEMO_HOME_KPIS.collectionDueSub}
            accentClass="text-[var(--pending)]"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Recent entries
          </span>
          <button
            type="button"
            className="text-[12px] font-medium text-[var(--brand-text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            See all
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {recent.map((e, i) => (
            <li key={`${e.lot}-${e.time}-${i}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
              >
                <span
                  className={
                    e.type === "inward"
                      ? "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--inward-bg)]"
                      : "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--outward-bg)]"
                  }
                >
                  {e.type === "inward" ? (
                    <ArrowLeft className="size-[18px] text-[var(--inward)]" strokeWidth={STROKE} />
                  ) : (
                    <ArrowRight className="size-[18px] text-[var(--outward)]" strokeWidth={STROKE} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[var(--text-tertiary)]">
                    {e.lot} · {e.time}
                  </span>
                  <span className="block font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    {e.party}
                  </span>
                  <span className="block text-[12px] text-[var(--text-secondary)]">
                    {e.godown} · {e.commodity}
                  </span>
                </span>
                <span
                  className={
                    e.type === "inward"
                      ? "shrink-0 text-[14px] font-semibold text-[var(--inward)]"
                      : "shrink-0 text-[14px] font-semibold text-[var(--outward)]"
                  }
                >
                  {e.type === "inward" ? "+" : "−"}
                  {e.bags} bags
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPageShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accentClass,
}: {
  label: string;
  value: string;
  sub: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">{label}</p>
      <p className={cn("font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums", accentClass)}>
        {value}
      </p>
      <p className="text-[11px] text-[var(--text-secondary)]">{sub}</p>
    </div>
  );
}
