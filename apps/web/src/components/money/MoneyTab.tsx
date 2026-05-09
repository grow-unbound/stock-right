"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2, Receipt, SearchX, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import { useDebouncedValue } from "@stockright/shared/hooks";
import { displayMoneyPartyPrimary, displayMoneyPartySecondary, filterMoneyRowsLocal, mergeUniqueMoneyRows } from "@stockright/shared/money";
import { loadMoneyListSnapshot, loadMoneyPendingRows, saveMoneyListSnapshot } from "@stockright/shared/offline/app-cache";
import { formatIndianCurrency, formatMoneyListDate } from "@stockright/shared/utils";
import { DEMO_FAB_MONEY_ACTIONS } from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { AddReceiptForm } from "@/components/money/add-receipt/AddReceiptForm";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { Button } from "@/components/ui/Button";
import { MoneyActivityTable } from "@/components/money/MoneyActivityTable";
import { useMoneyAccess } from "@/contexts/MoneyAccessContext";
import { useSessionUser } from "@/components/session/session-user-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { webMoneyAppCacheAdapter } from "@/lib/money-app-cache";
import { useIsOffline } from "@/hooks/useIsOffline";

const STROKE = 2;

type ChipId = "all" | "receipt" | "payment";

function chipToTransactionType(chip: ChipId): "all" | "receipt" | "payment" {
  return chip;
}

function paymentMethodLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
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
  const offline = useIsOffline();
  const { canManageMoney, loaded: accessLoaded } = useMoneyAccess();
  const { context } = useSessionUser();
  const warehouseId = context?.warehouseId ?? null;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const moneyCache = webMoneyAppCacheAdapter;

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const [chip, setChip] = useState<ChipId>("all");
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [moneyFeedNonce, setMoneyFeedNonce] = useState(0);

  useEffect(() => {
    function onMoneyRefresh() {
      setMoneyFeedNonce((n) => n + 1);
    }
    window.addEventListener("sr-money-refresh", onMoneyRefresh);
    return () => window.removeEventListener("sr-money-refresh", onMoneyRefresh);
  }, []);

  const [sortColumn, setSortColumn] = useState<MoneySortColumn>("occurred_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopPageSize, setDesktopPageSize] = useState(20);

  const [localData, setLocalData] = useState<MoneyMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize] = useState(15);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);

  const [kpis, setKpis] = useState<{ received: number; paid: number; rCount: number; pCount: number } | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);

  const [wide, setWide] = useState(true);

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const localDataRef = useRef<MoneyMovementRow[]>([]);
  localDataRef.current = localData;
  const prevDesktopSearchRef = useRef<string | null>(null);
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevDesktopChipRef = useRef<ChipId | null>(null);
  const prevMobileChipRef = useRef<ChipId | null>(null);

  const searchResults = useMemo(() => filterMoneyRowsLocal(localData, searchInput, chip), [localData, searchInput, chip]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setDesktopPage(1);
    setMobilePage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevDesktopSearchRef.current = null;
    prevMobileSearchRef.current = null;
    prevDesktopChipRef.current = null;
    prevMobileChipRef.current = null;
  }, [warehouseId]);

  useEffect(() => {
    if (!accessLoaded) return;
    if (!canManageMoney) {
      router.replace("/");
    }
  }, [accessLoaded, canManageMoney, router]);

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
  }, [warehouseId, accessLoaded, canManageMoney, supabase, moneyFeedNonce]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney || !offline) return;

    let cancelled = false;
    void (async () => {
      const snap = await loadMoneyListSnapshot(moneyCache, warehouseId, chip);
      const pending = await loadMoneyPendingRows(moneyCache, warehouseId);
      if (cancelled) return;
      const merged = mergeUniqueMoneyRows(snap, pending);
      setLocalData(merged);
      setTotalCount(merged.length);
      setInitialLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, chip, offline, canManageMoney, moneyCache]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney || offline || !wide) return;

    let cancelled = false;
    const tt = chipToTransactionType(chip);
    const search = debouncedSearch;
    const searchChanged = prevDesktopSearchRef.current !== null && prevDesktopSearchRef.current !== search;
    const chipChanged = prevDesktopChipRef.current !== null && prevDesktopChipRef.current !== chip;
    prevDesktopSearchRef.current = search;
    prevDesktopChipRef.current = chip;
    if (searchChanged || chipChanged) {
      setDesktopPage(1);
      setMobilePage(1);
    }
    const desktopPageToFetch = searchChanged || chipChanged ? 1 : desktopPage;

    if (localDataRef.current.length === 0) {
      setDesktopLoading(true);
    }
    if (search !== "") setRemoteSearchPending(true);

    void (async () => {
      try {
        const [count, rows] = await Promise.all([
          countMoneyMovements(supabase, {
            warehouseId,
            search,
            transactionType: tt,
          }),
          listMoneyMovements(supabase, {
            warehouseId,
            search,
            transactionType: tt,
            sortColumn,
            sortDirection,
            page: desktopPageToFetch,
            pageSize: desktopPageSize,
          }),
        ]);
        if (cancelled) return;
        setTotalCount(count);
        setLocalData(rows);
        if (desktopPageToFetch === 1 && search === "") {
          void saveMoneyListSnapshot(moneyCache, warehouseId, chip, rows);
        }
      } finally {
        if (!cancelled) {
          setDesktopLoading(false);
          setRemoteSearchPending(false);
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
    offline,
    wide,
    chip,
    debouncedSearch,
    desktopPage,
    desktopPageSize,
    sortColumn,
    sortDirection,
    supabase,
    moneyCache,
    moneyFeedNonce,
  ]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney || offline || wide) return;

    let cancelled = false;
    const tt = chipToTransactionType(chip);
    const search = debouncedSearch;
    const searchChanged = prevMobileSearchRef.current !== null && prevMobileSearchRef.current !== search;
    const chipChanged = prevMobileChipRef.current !== null && prevMobileChipRef.current !== chip;
    prevMobileSearchRef.current = search;
    prevMobileChipRef.current = chip;
    if (searchChanged || chipChanged) {
      setMobilePage(1);
    }
    const mobilePageToFetch = searchChanged || chipChanged ? 1 : mobilePage;

    const loadingMore = mobilePageToFetch > 1;

    if (loadingMore) setMobileLoadingMore(true);
    if (search !== "") setRemoteSearchPending(true);
    if (mobilePageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }

    void (async () => {
      try {
        if (mobilePageToFetch === 1) {
          const c = await countMoneyMovements(supabase, {
            warehouseId,
            search,
            transactionType: tt,
          });
          if (cancelled) return;
          setTotalCount(c);
        }

        const rows = await listMoneyMovements(supabase, {
          warehouseId,
          search,
          transactionType: tt,
          sortColumn: "occurred_at",
          sortDirection: "desc",
          page: mobilePageToFetch,
          pageSize: mobilePageSize,
        });

        if (cancelled) return;

        setLocalData((prev) => {
          const next = mobilePageToFetch === 1 ? rows : mergeUniqueMoneyRows(prev, rows);
          if (mobilePageToFetch === 1 && search === "") {
            void saveMoneyListSnapshot(moneyCache, warehouseId, chip, next);
          } else if (mobilePageToFetch > 1 && search === "") {
            void saveMoneyListSnapshot(moneyCache, warehouseId, chip, next);
          }
          return next;
        });
      } finally {
        if (!cancelled) {
          setMobileLoadingMore(false);
          setRemoteSearchPending(false);
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
    canManageMoney,
    offline,
    wide,
    supabase,
    moneyCache,
    moneyFeedNonce,
  ]);

  mobileNearEndRef.current = () => {
    if (!warehouseId || offline || mobileLoadingMore) return;
    const loaded = localData.length;
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
          className="min-w-[var(--cta-tab-min-width)] justify-center gap-2"
          onClick={() => {
            if (offline) {
              toast.error("Connect once to record money.");
              return;
            }
            setReceiptFormOpen(true);
          }}
        >
          <Receipt className="size-[18px] shrink-0" strokeWidth={STROKE} aria-hidden />
          {addReceipt.label}
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center gap-2"
          onClick={() => toast.info("Add Payment will be available soon.")}
        >
          <Wallet className="size-[18px] shrink-0" strokeWidth={STROKE} aria-hidden />
          {addPayment.label}
        </Button>
      </>
    ) : null;

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--text-tertiary)]" aria-hidden />
    ) : null;

  const showListEmpty =
    Boolean(warehouseId) && !offline && !initialLoading && !desktopLoading && searchResults.length === 0;

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
      moneyFabOnSelect={(id) => {
        if (offline) {
          toast.error("Connect once to record money.");
          return;
        }
        if (id === "add_receipt") router.push("/money/receipt/new");
        if (id === "add_payment") toast.info("Add Payment will be available soon.");
      }}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      searchAccessory={searchAccessory}
    >
      {!warehouseId ? (
        <p className="text-[15px] text-[var(--text-secondary)]">Select a warehouse to see money activity.</p>
      ) : (
        <div className="flex flex-col gap-4 px-0 pt-4">
          {offline ? (
            <p className="text-[13px] text-[var(--text-secondary)]">You’re offline. Showing saved activity from this device.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">This month received</p>
              <p className="font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums text-[var(--inward)]">
                {kpis ? formatIndianCurrency(kpis.received) : "—"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {kpis ? `${kpis.rCount} receipts recorded` : "Loading totals…"}
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">This month paid</p>
              <p className="font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums text-[var(--outward)]">
                {kpis ? formatIndianCurrency(kpis.paid) : "—"}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">{kpis ? `${kpis.pCount} payments recorded` : "Loading totals…"}</p>
            </div>
          </div>

          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Recent activity</p>

          <div className="hidden sm:block">
            {offline && localData.length === 0 ? (
              <p className="text-[15px] text-[var(--text-secondary)]">Connect once to load money activity on this device.</p>
            ) : desktopLoading || (initialLoading && localData.length === 0) ? (
              <MoneyListSkeleton />
            ) : showListEmpty ? (
              <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
              </div>
            ) : (
              <MoneyActivityTable
                rows={searchResults}
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
                formatOccurredAt={(iso) => formatMoneyListDate(iso)}
                paymentMethodLabel={paymentMethodLabel}
                referenceLabel={displayMoneyReference}
              />
            )}
          </div>

          <div className="sm:hidden">
            {offline && localData.length === 0 ? (
              <p className="px-1 text-[15px] text-[var(--text-secondary)]">Connect once to load money activity on this device.</p>
            ) : initialLoading && localData.length === 0 ? (
              <MoneyListSkeleton />
            ) : showListEmpty ? (
              <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {searchResults.map((t) => {
                  const isReceipt = t.transaction_type === "receipt";
                  const secondary = displayMoneyPartySecondary(t);
                  return (
                    <li key={`${t.transaction_type}-${t.event_id}`}>
                      <div className="flex min-h-[48px] w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-3 text-left">
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
                          <span className="block font-[family-name:var(--font-body)] text-[11px] text-[var(--text-tertiary)]">
                            {formatMoneyListDate(t.occurred_at)}
                          </span>
                          <span className="mt-0.5 block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                            {displayMoneyPartyPrimary(t)}
                          </span>
                          {secondary ? (
                            <span className="mt-0.5 block truncate text-left font-[family-name:var(--font-body)] text-[13px] text-[var(--text-secondary)]">
                              {secondary}
                            </span>
                          ) : null}
                          {isReceipt && t.receipt_allocated === false ? (
                            <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                              Needs allocation
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={
                              isReceipt
                                ? "block font-[family-name:var(--font-display)] text-[28px] font-bold tabular-nums leading-none text-[var(--inward)]"
                                : "block font-[family-name:var(--font-display)] text-[28px] font-bold tabular-nums leading-none text-[var(--outward)]"
                            }
                          >
                            {formatIndianCurrency(t.amount)}
                          </span>
                          <span className="mt-1 block font-[family-name:var(--font-body)] text-[13px] capitalize text-[var(--text-secondary)]">
                            {paymentMethodLabel(t.payment_method)}
                          </span>
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

      <FormSidebar
        open={receiptFormOpen && Boolean(warehouseId) && !offline}
        title="Add Receipt"
        onClose={() => setReceiptFormOpen(false)}
      >
        {warehouseId ? (
          <AddReceiptForm
            variant="sidebar"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setReceiptFormOpen(false)}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent("sr-money-refresh"));
            }}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
