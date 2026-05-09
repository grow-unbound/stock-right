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
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
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
          <DashboardKpiCard
            label="Today inward"
            value={String(DEMO_HOME_KPIS.todayInwardBags)}
            sub={DEMO_HOME_KPIS.todayInwardSub}
            accentClass="text-[var(--inward)]"
          />
          <DashboardKpiCard
            label="Today outward"
            value={String(DEMO_HOME_KPIS.todayOutwardBags)}
            sub={DEMO_HOME_KPIS.todayOutwardSub}
            accentClass="text-[var(--outward)]"
          />
          <DashboardKpiCard
            label="Stock on hand"
            value={formatRupeesPlain(DEMO_HOME_KPIS.stockOnHandBags)}
            sub={DEMO_HOME_KPIS.stockOnHandSub}
            accentClass="text-[var(--text-primary)]"
          />
          <DashboardKpiCard
            label="Collection due"
            value={formatIndianCurrency(DEMO_HOME_COLLECTION_DUE_RUPEES)}
            sub={DEMO_HOME_KPIS.collectionDueSub}
            accentClass="text-[var(--pending)]"
          />
        </div>

        <DashboardSectionHeader
          label="Recent entries"
          trailing={
            <button
              type="button"
              className="text-[12px] font-medium text-[var(--brand-text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] cursor-pointer"
            >
              See all
            </button>
          }
        />

        <ul className="flex flex-col gap-2">
          {recent.map((e, i) => (
            <li key={`${e.lot}-${e.time}-${i}`}>
              <RegisterListRow
                as="button"
                icon={
                  e.type === "inward" ? (
                    <ArrowLeft className="size-[18px] text-[var(--inward)]" strokeWidth={STROKE} />
                  ) : (
                    <ArrowRight className="size-[18px] text-[var(--outward)]" strokeWidth={STROKE} />
                  )
                }
                iconShellClassName={
                  e.type === "inward" ? "bg-[var(--inward-bg)]" : "bg-[var(--outward-bg)]"
                }
                meta={
                  <>
                    {e.lot} · {e.time}
                  </>
                }
                title={e.party}
                detail={
                  <>
                    {e.godown} · {e.commodity}
                  </>
                }
                trailing={
                  <span
                    className={
                      e.type === "inward"
                        ? "text-[14px] font-semibold text-[var(--inward)]"
                        : "text-[14px] font-semibold text-[var(--outward)]"
                    }
                  >
                    {e.type === "inward" ? "+" : "−"}
                    {e.bags} bags
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </DashboardPageShell>
  );
}
