"use client";

import { useState } from "react";
import { Receipt, Wallet } from "lucide-react";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  DEMO_FAB_MONEY_ACTIONS,
  DEMO_MONEY_FILTER_CHIPS,
  DEMO_MONEY_KPIS,
  DEMO_MONEY_MONTH_PAID_RUPEES,
  DEMO_MONEY_MONTH_RECEIVED_RUPEES,
  DEMO_MONEY_TXNS,
  filterMoneyTxns,
} from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { LandingFabActionSheet } from "@/components/dashboard/LandingFabActionSheet";
import { Button } from "@/components/ui/Button";

const STROKE = 2;

type DesktopMoneySheet = "receipt" | "payment" | null;

export default function MoneyPage() {
  const initialChip = DEMO_MONEY_FILTER_CHIPS[0]?.id ?? "all";
  const [chip, setChip] = useState(initialChip);
  const [desktopSheet, setDesktopSheet] = useState<DesktopMoneySheet>(null);
  const txns = filterMoneyTxns(DEMO_MONEY_TXNS, chip);

  const addReceipt = DEMO_FAB_MONEY_ACTIONS[0];
  const addPayment = DEMO_FAB_MONEY_ACTIONS[1];

  const desktopActions =
    addReceipt && addPayment ? (
      <>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={() => setDesktopSheet("receipt")}
        >
          {addReceipt.label}
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={() => setDesktopSheet("payment")}
        >
          {addPayment.label}
        </Button>
      </>
    ) : null;

  return (
    <DashboardPageShell
      title="Money"
      searchPlaceholder="Search receipts, payments, parties…"
      chips={DEMO_MONEY_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={setChip}
      desktopActions={desktopActions}
    >
      <div className="flex flex-col gap-4 px-0 pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              This month received
            </p>
            <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold tabular-nums text-[var(--inward)]">
              {formatIndianCurrency(DEMO_MONEY_MONTH_RECEIVED_RUPEES)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">{DEMO_MONEY_KPIS.receivedSub}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              This month paid
            </p>
            <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold tabular-nums text-[var(--outward)]">
              {formatIndianCurrency(DEMO_MONEY_MONTH_PAID_RUPEES)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">{DEMO_MONEY_KPIS.paidSub}</p>
          </div>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Recent transactions
        </p>

        <ul className="flex flex-col gap-2">
          {txns.map((t, i) => {
            const isReceipt = t.type === "receipt";
            return (
              <li key={`${t.ref}-${i}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-3 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                >
                  <span
                    className={
                      isReceipt
                        ? "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--inward-border)] bg-[var(--inward-bg)] text-[var(--inward)]"
                        : "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outward-border)] bg-[var(--outward-bg)] text-[var(--outward)]"
                    }
                  >
                    {isReceipt ? (
                      <Receipt className="size-[18px]" strokeWidth={STROKE} />
                    ) : (
                      <Wallet className="size-[18px]" strokeWidth={STROKE} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-[var(--text-tertiary)]">
                      {t.ref} · {t.date} · {t.method}
                    </span>
                    <span className="mt-0.5 block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                      {t.party}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={
                        isReceipt
                          ? "block font-[family-name:var(--font-display)] text-[17px] font-bold tabular-nums text-[var(--inward)]"
                          : "block font-[family-name:var(--font-display)] text-[17px] font-bold tabular-nums text-[var(--outward)]"
                      }
                    >
                      {isReceipt ? "+" : "−"}
                      {formatIndianCurrency(t.amountRupee)}
                    </span>
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      {isReceipt ? "RECEIPT" : "PAYMENT"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {desktopSheet && addReceipt && addPayment ? (
        <LandingFabActionSheet
          open
          title={desktopSheet === "receipt" ? addReceipt.label : addPayment.label}
          actions={desktopSheet === "receipt" ? [addReceipt] : [addPayment]}
          onClose={() => setDesktopSheet(null)}
        />
      ) : null}
    </DashboardPageShell>
  );
}
