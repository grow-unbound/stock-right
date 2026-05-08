"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Wallet } from "lucide-react";
import {
  type MoneyMovementRow,
  type MoneySortColumn,
  MoneySortColumnSchema,
  MONEY_FILTER_CHIPS,
  calendarMonthRangeLocal,
  countMoneyMovements,
  displayMoneyReference,
  fetchMoneyMonthTotals,
  listMoneyMovements,
} from "@stockright/shared/api";
import { formatDate, formatIndianCurrency } from "@stockright/shared/utils";
import { DEMO_FAB_MONEY_ACTIONS } from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { LandingFabActionSheet } from "@/components/dashboard/LandingFabActionSheet";
import { Button } from "@/components/ui/Button";
import { MoneyActivityTable } from "@/components/money/MoneyActivityTable";
import { useMoneyAccess } from "@/contexts/MoneyAccessContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STROKE = 2;

type DesktopMoneySheet = "receipt" | "payment" | null;

type ChipId = "all" | "receipt" | "payment";

function chipToTransactionType(chip: ChipId): "all" | "receipt" | "payment" {
  return chip;
}

function paymentMethodLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRowAmount(row: MoneyMovementRow): string {
  const prefix = row.transaction_type === "receipt" ? "+" : "−";
  return `${prefix}${formatIndianCurrency(row.amount)}`;
}

function MoneyListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-[72px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
      ))}
    </ul>
  );
}

export function MoneyTab() {
  const router = useRouter();
  const { canManageMoney, loaded: accessLoaded } = useMoneyAccess();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chip, setChip] = useState<ChipId>("all");
  const [desktopSheet, setDesktopSheet] = useState<DesktopMoneySheet>(null);

  const [sortColumn, setSortColumn] = useState<MoneySortColumn>("occurred_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopPageSize, setDesktopPageSize] = useState(20);

  const [mobileRows, setMobileRows] = useState<MoneyMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize] = useState(15);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [mobileListRevision, setMobileListRevision] = useState(0);

  const [totalCount, setTotalCount] = useState(0);
  const [desktopRows, setDesktopRows] = useState<MoneyMovementRow[]>([]);

  const [kpis, setKpis] = useState<{ received: number; paid: number; rCount: number; pCount: number } | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [desktopLoading, setDesktopLoading] = useState(false);

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wid = typeof window !== "undefined" ? window.localStorage.getItem("active_warehouse_id") : null;
    setWarehouseId(wid && wid.length > 0 ? wid : null);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!accessLoaded) return;
    if (!canManageMoney) {
      router.replace("/");
    }
  }, [accessLoaded, canManageMoney, router]);

  useEffect(() => {
    setDesktopPage(1);
    setMobilePage(1);
    setMobileRows([]);
    setMobileListRevision((r) => r + 1);
  }, [debouncedSearch, chip, warehouseId]);

  useEffect(() => {
    if (!warehouseId || !accessLoaded || !canManageMoney) return;

    const now = new Date();
    const range = calendarMonthRangeLocal(now.getFullYear(), now.getMonth());

    void (async () => {
      try {
        const totals = await fetchMoneyMonthTotals(supabase, warehouseId, range);
        setKpis({
          received: totals.receivedRupees,
          paid: totals.paidRupees,
          rCount: totals.receiptCount,
          pCount: totals.paymentCount,
        });
      } catch {
        setKpis(null);
      }
    })();
  }, [warehouseId, accessLoaded, canManageMoney, supabase]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney) return;

    let cancelled = false;
    const tt = chipToTransactionType(chip);
    setDesktopLoading(true);

    void (async () => {
      try {
        const [count, rows] = await Promise.all([
          countMoneyMovements(supabase, {
            warehouseId,
            search: debouncedSearch,
            transactionType: tt,
          }),
          listMoneyMovements(supabase, {
            warehouseId,
            search: debouncedSearch,
            transactionType: tt,
            sortColumn,
            sortDirection,
            page: desktopPage,
            pageSize: desktopPageSize,
          }),
        ]);
        if (cancelled) return;
        setTotalCount(count);
        setDesktopRows(rows);
      } finally {
        if (!cancelled) {
          setDesktopLoading(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    warehouseId,
    canManageMoney,
    chip,
    debouncedSearch,
    desktopPage,
    desktopPageSize,
    sortColumn,
    sortDirection,
    supabase,
  ]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney) return;

    let cancelled = false;
    const tt = chipToTransactionType(chip);
    const loadingMore = mobilePage > 1;

    if (loadingMore) setMobileLoadingMore(true);

    void (async () => {
      try {
        if (mobilePage === 1) {
          const c = await countMoneyMovements(supabase, {
            warehouseId,
            search: debouncedSearch,
            transactionType: tt,
          });
          if (cancelled) return;
          setTotalCount(c);
        }

        const rows = await listMoneyMovements(supabase, {
          warehouseId,
          search: debouncedSearch,
          transactionType: tt,
          sortColumn: "occurred_at",
          sortDirection: "desc",
          page: mobilePage,
          pageSize: mobilePageSize,
        });

        if (cancelled) return;

        setMobileRows((prev) => {
          if (mobilePage === 1) return rows;
          const seen = new Set(prev.map((r) => `${r.transaction_type}:${r.event_id}`));
          const merged = [...prev];
          for (const r of rows) {
            const k = `${r.transaction_type}:${r.event_id}`;
            if (!seen.has(k)) {
              seen.add(k);
              merged.push(r);
            }
          }
          return merged;
        });
      } finally {
        if (!cancelled) {
          setMobileLoadingMore(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    warehouseId,
    debouncedSearch,
    chip,
    mobilePage,
    mobilePageSize,
    mobileListRevision,
    canManageMoney,
    supabase,
  ]);

  mobileNearEndRef.current = () => {
    if (!warehouseId || mobileLoadingMore) return;
    const loaded = mobileRows.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < mobilePage * mobilePageSize - 4) return;
    setMobilePage((p) => p + 1);
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mobileNearEndRef.current();
        }
      },
      { rootMargin: "280px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function handleSort(column: MoneySortColumn) {
    const parsed = MoneySortColumnSchema.safeParse(column);
    const col = parsed.success ? parsed.data : "occurred_at";
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(
        col === "counterparty_name" || col === "reference_number" || col === "payment_method" || col === "transaction_type"
          ? "asc"
          : "desc"
      );
    }
    setDesktopPage(1);
  }

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

  if (!accessLoaded || !canManageMoney) {
    return <div className="min-h-[200px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />;
  }

  return (
    <DashboardPageShell
      title="Money"
      searchPlaceholder="Search by reference, party, method, date…"
      chips={MONEY_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={(id) => setChip(id as ChipId)}
      desktopActions={desktopActions}
      moneyFabEnabled={canManageMoney}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
    >
      {!warehouseId ? (
        <p className="text-[15px] text-[var(--text-secondary)]">Select a warehouse to see money activity.</p>
      ) : (
        <div className="flex flex-col gap-4 px-0 pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">This month received</p>
              <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold tabular-nums text-[var(--inward)]">
                {kpis ? formatIndianCurrency(kpis.received) : "—"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {kpis ? `${kpis.rCount} receipts recorded` : "Loading totals…"}
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">This month paid</p>
              <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold tabular-nums text-[var(--outward)]">
                {kpis ? formatIndianCurrency(kpis.paid) : "—"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">{kpis ? `${kpis.pCount} payments recorded` : "Loading totals…"}</p>
            </div>
          </div>

          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Recent activity</p>

          <div className="hidden sm:block">
            {desktopLoading || initialLoading ? (
              <MoneyListSkeleton />
            ) : (
              <MoneyActivityTable
                rows={desktopRows}
                totalCount={totalCount}
                page={desktopPage}
                pageSize={desktopPageSize}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                onPageChange={(p) => setDesktopPage(p)}
                onPageSizeChange={(size) => {
                  setDesktopPageSize(size);
                  setDesktopPage(1);
                }}
                formatOccurredAt={(iso) => formatDate(iso)}
                formatAmount={formatRowAmount}
                paymentMethodLabel={paymentMethodLabel}
                referenceLabel={displayMoneyReference}
              />
            )}
          </div>

          <div className="sm:hidden">
            {initialLoading && mobileRows.length === 0 ? (
              <MoneyListSkeleton />
            ) : (
              <ul className="flex flex-col gap-2">
                {mobileRows.map((t) => {
                  const isReceipt = t.transaction_type === "receipt";
                  return (
                    <li key={`${t.transaction_type}-${t.event_id}`}>
                      <div className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-3 text-left">
                        <span
                          className={
                            isReceipt
                              ? "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--inward-border)] bg-[var(--inward-bg)] text-[var(--inward)]"
                              : "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outward-border)] bg-[var(--outward-bg)] text-[var(--outward)]"
                          }
                        >
                          {isReceipt ? (
                            <HandCoins className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                          ) : (
                            <Wallet className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-[var(--text-tertiary)]">
                            {displayMoneyReference(t)} · {formatDate(t.occurred_at)}
                          </span>
                          <span className="mt-0.5 block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                            {t.counterparty_name}
                          </span>
                          {isReceipt && t.receipt_allocated === false ? (
                            <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                              Allocate amount
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={
                              isReceipt
                                ? "block font-[family-name:var(--font-display)] text-[17px] font-bold tabular-nums text-[var(--inward)]"
                                : "block font-[family-name:var(--font-display)] text-[17px] font-bold tabular-nums text-[var(--outward)]"
                            }
                          >
                            {formatRowAmount(t)}
                          </span>
                          <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[11px] capitalize text-[var(--text-tertiary)]">
                            {paymentMethodLabel(t.payment_method)}
                          </span>
                          {!isReceipt && t.payment_type_name ? (
                            <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              {t.payment_type_name}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
          </div>
        </div>
      )}

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
