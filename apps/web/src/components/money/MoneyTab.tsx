"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2, Receipt, SearchX, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  type MoneyMovementRow,
  type MoneySortColumn,
  MONEY_FILTER_CHIPS,
  MONEY_REFRESH_EVENT,
  countMoneyMovements,
  displayMoneyReference,
  listMoneyMovements,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { shouldPrefetchListScroll } from "@stockright/shared/list-scroll-prefetch";
import { displayMoneyPartyPrimary, displayMoneyPartySecondary, filterMoneyRowsLocal, mergeUniqueMoneyRows } from "@stockright/shared/money";
import { loadMoneyListSnapshot, loadMoneyPendingRows, saveMoneyListSnapshot } from "@stockright/shared/offline/app-cache";
import { formatIndianCurrency, formatMoneyListDate } from "@stockright/shared/utils";
import { DEMO_FAB_MONEY_ACTIONS } from "@stockright/shared/demo";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { DesktopEntityTabSplit } from "@/components/dashboard/DesktopEntityTabSplit";
import { DesktopListPaneChrome } from "@/components/dashboard/DesktopListPaneChrome";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { AddReceiptForm } from "@/components/money/add-receipt/AddReceiptForm";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { AddPaymentForm } from "@/components/money/add-payment/AddPaymentForm";
import { MoneyActivityTable } from "@/components/money/MoneyActivityTable";
import { Button } from "@/components/ui/Button";
import { useMoneyAccess } from "@/contexts/MoneyAccessContext";
import { useSessionUser } from "@/components/session/session-user-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { webMoneyAppCacheAdapter } from "@/lib/money-app-cache";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useListScrollPrefetch } from "@/hooks/useListScrollPrefetch";
import { cn } from "@/lib/utils";

const STROKE = 2;
const LIST_PAGE_SIZE = 15;

type ChipId = "all" | "receipt" | "payment";

function chipToTransactionType(chip: ChipId): "all" | "receipt" | "payment" {
  return chip;
}

function paymentMethodLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

function moneyRowKey(t: MoneyMovementRow): string {
  return `${t.transaction_type}-${t.event_id}`;
}

function MoneyListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[72px] rounded-[var(--radius-md)] bg-[var(--bg-subtle)] skeleton" />
      ))}
    </div>
  );
}

function DesktopMoneySplitSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-0">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-[var(--border-default)]">
        <div className="flex flex-col gap-2 border-b border-[var(--border-default)] p-2">
          <div className="h-12 skeleton rounded-[var(--radius-md)]" />
          <div className="h-8 skeleton rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex flex-col gap-2 p-2 pt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] skeleton rounded-[var(--radius-md)]" />
          ))}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 p-4">
        <div className="h-full min-h-[200px] skeleton rounded-[var(--radius-md)]" />
      </div>
    </div>
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
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [moneyFeedNonce, setMoneyFeedNonce] = useState(0);

  useEffect(() => {
    function onMoneyRefresh() {
      setMoneyFeedNonce((n) => n + 1);
    }
    window.addEventListener(MONEY_REFRESH_EVENT, onMoneyRefresh);
    return () => window.removeEventListener(MONEY_REFRESH_EVENT, onMoneyRefresh);
  }, []);

  const [localData, setLocalData] = useState<MoneyMovementRow[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listLoadingMore, setListLoadingMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);

  const [wide, setWide] = useState(true);
  const [pane3Open, setPane3Open] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [desktopTableRows, setDesktopTableRows] = useState<MoneyMovementRow[]>([]);
  const [desktopTableTotal, setDesktopTableTotal] = useState(0);
  const [desktopTableLoading, setDesktopTableLoading] = useState(false);
  const [moneyTablePage, setMoneyTablePage] = useState(1);
  const [moneyTablePageSize, setMoneyTablePageSize] = useState(LIST_PAGE_SIZE);
  const [moneyTableSortColumn, setMoneyTableSortColumn] = useState<MoneySortColumn>("occurred_at");
  const [moneyTableSortDirection, setMoneyTableSortDirection] = useState<"asc" | "desc">("desc");

  const seedMoneyForPane3Ref = useRef<MoneyMovementRow | null>(null);
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const pane3OpenRef = useRef(pane3Open);
  pane3OpenRef.current = pane3Open;
  const moneyTablePageRef = useRef(moneyTablePage);
  moneyTablePageRef.current = moneyTablePage;
  const pane3WasOpenRef = useRef(pane3Open);

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const desktopListScrollRef = useRef<HTMLDivElement>(null);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);
  const localDataRef = useRef<MoneyMovementRow[]>([]);
  localDataRef.current = localData;
  const prevSearchRef = useRef<string | null>(null);
  const prevChipRef = useRef<ChipId | null>(null);
  const prevFeedNonceRef = useRef(moneyFeedNonce);
  const listLoadingMoreRef = useRef(false);
  listLoadingMoreRef.current = listLoadingMore;

  const searchResults = useMemo(() => filterMoneyRowsLocal(localData, searchInput, chip), [localData, searchInput, chip]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setListPage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevChipRef.current = null;
    prevFeedNonceRef.current = moneyFeedNonce;
    setSelectedKey(null);
  }, [warehouseId]);

  useEffect(() => {
    setListPage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevChipRef.current = null;
  }, [wide]);

  useEffect(() => {
    if (!accessLoaded) return;
    if (!canManageMoney) {
      router.replace("/");
    }
  }, [accessLoaded, canManageMoney, router]);

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
    if (!warehouseId || !canManageMoney || offline) return;
    if (wide && !pane3Open) return;

    let cancelled = false;
    const tt = chipToTransactionType(chip);
    const search = debouncedSearch;
    const searchChanged = prevSearchRef.current !== null && prevSearchRef.current !== search;
    const chipChanged = prevChipRef.current !== null && prevChipRef.current !== chip;
    const feedChanged = prevFeedNonceRef.current !== moneyFeedNonce;
    prevSearchRef.current = search;
    prevChipRef.current = chip;
    prevFeedNonceRef.current = moneyFeedNonce;
    if (searchChanged || chipChanged || feedChanged) {
      setListPage(1);
    }
    const pageToFetch = searchChanged || chipChanged || feedChanged ? 1 : listPage;

    const loadingMore = pageToFetch > 1;
    if (loadingMore) setListLoadingMore(true);
    if (search !== "") setRemoteSearchPending(true);
    if (pageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }

    void (async () => {
      try {
        if (pageToFetch === 1) {
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
          page: pageToFetch,
          pageSize: LIST_PAGE_SIZE,
        });

        if (cancelled) return;

        setLocalData((prev) => {
          const seed = seedMoneyForPane3Ref.current;
          let next: MoneyMovementRow[];
          if (pageToFetch === 1 && seed) {
            seedMoneyForPane3Ref.current = null;
            next = mergeUniqueMoneyRows([seed], rows);
          } else {
            next = pageToFetch === 1 ? rows : mergeUniqueMoneyRows(prev, rows);
          }
          if (pageToFetch === 1 && search === "") {
            void saveMoneyListSnapshot(moneyCache, warehouseId, chip, next);
          } else if (pageToFetch > 1 && search === "") {
            void saveMoneyListSnapshot(moneyCache, warehouseId, chip, next);
          }
          return next;
        });
      } finally {
        if (!cancelled) {
          setListLoadingMore(false);
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
    listPage,
    canManageMoney,
    offline,
    supabase,
    moneyCache,
    moneyFeedNonce,
    wide,
    pane3Open,
  ]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney || offline || !wide || pane3Open) return;
    let cancelled = false;
    setDesktopTableLoading(true);
    const tt = chipToTransactionType(chip);
    const search = debouncedSearch;
    void (async () => {
      try {
        const c = await countMoneyMovements(supabase, {
          warehouseId,
          search,
          transactionType: tt,
        });
        if (cancelled) return;
        setDesktopTableTotal(c);
        const rows = await listMoneyMovements(supabase, {
          warehouseId,
          search,
          transactionType: tt,
          sortColumn: moneyTableSortColumn,
          sortDirection: moneyTableSortDirection,
          page: moneyTablePage,
          pageSize: moneyTablePageSize,
        });
        if (cancelled) return;
        setDesktopTableRows(rows);
      } finally {
        if (!cancelled) setDesktopTableLoading(false);
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
    pane3Open,
    chip,
    debouncedSearch,
    moneyTablePage,
    moneyTablePageSize,
    moneyTableSortColumn,
    moneyTableSortDirection,
    supabase,
    moneyFeedNonce,
  ]);

  useEffect(() => {
    if (!(wide && !pane3Open)) return;
    setMoneyTablePage(1);
  }, [debouncedSearch, chip, wide, pane3Open]);

  useEffect(() => {
    const opened = pane3Open && !pane3WasOpenRef.current;
    pane3WasOpenRef.current = pane3Open;
    if (!opened || !wide || offline || !warehouseId || !canManageMoney) return;
    if (localDataRef.current.length > 0) return;
    setListPage(1);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevChipRef.current = null;
  }, [pane3Open, wide, offline, warehouseId, canManageMoney]);

  const prefetchNext = useCallback(() => {
    if (!warehouseId || offline || listLoadingMore || !pane3Open) return;
    const loaded = localData.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    setListPage((p) => p + 1);
  }, [warehouseId, offline, listLoadingMore, localData.length, totalCount, pane3Open]);

  mobileNearEndRef.current = prefetchNext;

  useListScrollPrefetch({
    scrollRef: desktopListScrollRef,
    hasMore: Boolean(
      warehouseId &&
        !offline &&
        pane3Open &&
        localData.length > 0 &&
        totalCount > 0 &&
        localData.length < totalCount
    ),
    loadingMore: listLoadingMore,
    onPrefetch: prefetchNext,
    enabled: wide && pane3Open && Boolean(warehouseId) && !offline,
    watchKey: `${localData.length}-${totalCount}-${listPage}`,
  });

  useEffect(() => {
    if (wide) return;
    if (!warehouseId || offline) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (listLoadingMoreRef.current) return;
        const loaded = localDataRef.current.length;
        if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
        const st = window.scrollY;
        const ch = window.innerHeight;
        const sh = document.documentElement.scrollHeight;
        if (
          shouldPrefetchListScroll(st, ch, sh, {
            hasMore: loaded < totalCount && loaded > 0 && totalCount > 0,
            loading: listLoadingMoreRef.current,
          })
        ) {
          prefetchNext();
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [wide, warehouseId, offline, prefetchNext, totalCount]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined" || wide) return;

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
  }, [wide]);

  useEffect(() => {
    if ((receiptFormOpen || paymentFormOpen) && wide) {
      setPane3Open(true);
      setSelectedKey(null);
    }
  }, [receiptFormOpen, paymentFormOpen, wide]);

  useEffect(() => {
    if (!pane3Open) return;
    if (!searchResults.length) {
      if (!initialLoading) setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && searchResults.some((r) => moneyRowKey(r) === prev)) return prev;
      return moneyRowKey(searchResults[0]!);
    });
  }, [searchResults, pane3Open, initialLoading]);

  const selectedRow = useMemo(
    () => searchResults.find((r) => moneyRowKey(r) === selectedKey) ?? null,
    [searchResults, selectedKey]
  );

  const addReceipt = DEMO_FAB_MONEY_ACTIONS[0];
  const addPayment = DEMO_FAB_MONEY_ACTIONS[1];

  const openReceiptForm = () => {
    setPaymentFormOpen(false);
    setReceiptFormOpen(true);
  };

  const openPaymentForm = () => {
    setReceiptFormOpen(false);
    setPaymentFormOpen(true);
  };

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
            openReceiptForm();
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
          onClick={() => {
            if (offline) {
              toast.error("Connect once to record money.");
              return;
            }
            openPaymentForm();
          }}
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
    Boolean(warehouseId) && !offline && !initialLoading && searchResults.length === 0;

  const showMobileSkeleton =
    !wide && !!warehouseId && !offline && initialLoading && localData.length === 0;

  const showDesktopListSkeleton =
    wide && !!warehouseId && !offline && pane3Open && initialLoading && localData.length === 0;
  const showDesktopTableSkeleton =
    wide && !!warehouseId && !offline && !pane3Open && desktopTableLoading && desktopTableRows.length === 0;
  const showDesktopSplitSkeleton = showDesktopListSkeleton || showDesktopTableSkeleton;

  function scrollListToTop() {
    if (desktopListScrollRef.current) desktopListScrollRef.current.scrollTop = 0;
    if (listScrollContainerRef.current) listScrollContainerRef.current.scrollTop = 0;
    if (!wide) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleMoneyFormSuccess() {
    window.dispatchEvent(new CustomEvent(MONEY_REFRESH_EVENT));
    scrollListToTop();
    setPane3Open(true);
  }

  function handleMoneyTableSort(column: MoneySortColumn) {
    if (column === moneyTableSortColumn) {
      setMoneyTableSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setMoneyTableSortColumn(column);
      setMoneyTableSortDirection("desc");
    }
    setMoneyTablePage(1);
  }

  const listBlock = (opts: { forDesktopPane: boolean }) => {
    const inDesktop = opts.forDesktopPane;

    if (inDesktop && wide && !pane3Open) {
      if (offline) {
        return (
          <p className="text-[15px] text-[var(--text-secondary)]">
            Connect once to load money activity on this device.
          </p>
        );
      }
      if (!desktopTableLoading && desktopTableTotal === 0) {
        return (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 text-center py-10"
            )}
          >
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={STROKE} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
          </div>
        );
      }
      return (
        <MoneyActivityTable
          rows={desktopTableRows}
          totalCount={desktopTableTotal}
          page={moneyTablePage}
          pageSize={moneyTablePageSize}
          sortColumn={moneyTableSortColumn}
          sortDirection={moneyTableSortDirection}
          onSort={handleMoneyTableSort}
          onPageChange={setMoneyTablePage}
          onPageSizeChange={(size) => {
            setMoneyTablePageSize(size);
            setMoneyTablePage(1);
          }}
          formatOccurredAt={(iso) => formatMoneyListDate(iso)}
          paymentMethodLabel={paymentMethodLabel}
          referenceLabel={(row) => displayMoneyReference(row)}
          onRowClick={(row) => {
            seedMoneyForPane3Ref.current = row;
            setSelectedKey(moneyRowKey(row));
            setPane3Open(true);
            setReceiptFormOpen(false);
            setPaymentFormOpen(false);
          }}
        />
      );
    }

    return (
      <>
        {offline && localData.length === 0 ? (
          <p className={cn("text-[15px] text-[var(--text-secondary)]", !inDesktop && "px-1")}>
            Connect once to load money activity on this device.
          </p>
        ) : (inDesktop ? showDesktopListSkeleton : showMobileSkeleton) ? (
          <MoneyListSkeleton />
        ) : showListEmpty ? (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 text-center py-10"
            )}
          >
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={STROKE} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {searchResults.map((t) => {
              const isReceipt = t.transaction_type === "receipt";
              const secondary = displayMoneyPartySecondary(t);
              const k = moneyRowKey(t);
              const formOpen = receiptFormOpen || paymentFormOpen;
              return (
                <li key={k}>
                  <RegisterListRow
                    as="button"
                    selected={selectedKey === k && wide && !formOpen}
                    onClick={() => {
                      setSelectedKey(k);
                      if (!pane3Open) setPane3Open(true);
                      setReceiptFormOpen(false);
                      setPaymentFormOpen(false);
                    }}
                    icon={
                      isReceipt ? (
                        <HandCoins className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                      ) : (
                        <Wallet className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                      )
                    }
                    iconShellClassName={
                      isReceipt ? "bg-[var(--inward-bg)] text-[var(--inward)]" : "bg-[var(--outward-bg)] text-[var(--outward)]"
                    }
                    meta={formatMoneyListDate(t.occurred_at)}
                    title={displayMoneyPartyPrimary(t)}
                    detail={
                      secondary || (isReceipt && t.receipt_allocated === false) ? (
                        <>
                          {secondary ? (
                            <span className="block truncate text-[12px] text-[var(--text-secondary)]">{secondary}</span>
                          ) : null}
                          {isReceipt && t.receipt_allocated === false ? (
                            <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                              Needs allocation
                            </span>
                          ) : null}
                        </>
                      ) : undefined
                    }
                    trailing={
                      <span
                        className={cn(
                          "text-[14px] font-semibold tabular-nums leading-snug",
                          isReceipt ? "text-[var(--inward)]" : "text-[var(--outward)]"
                        )}
                      >
                        {formatIndianCurrency(t.amount)}
                      </span>
                    }
                    trailingSub={paymentMethodLabel(t.payment_method)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {listLoadingMore ? (
          <div className="mt-2 h-[72px] skeleton rounded-[var(--radius-md)]" />
        ) : null}
        {!inDesktop ? <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden /> : null}
      </>
    );
  };

  const detailsBody = () => {
    if (receiptFormOpen && warehouseId) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AddReceiptForm
            variant="detailPane"
            title="Add receipt"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setReceiptFormOpen(false)}
            onSuccess={handleMoneyFormSuccess}
          />
        </div>
      );
    }
    if (paymentFormOpen && warehouseId) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AddPaymentForm
            variant="detailPane"
            title="Add payment"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setPaymentFormOpen(false)}
            onSuccess={handleMoneyFormSuccess}
          />
        </div>
      );
    }
    if (!selectedRow) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 bg-[var(--bg-page)] px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
              Details
            </h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto p-4 pr-3">
            <div className="flex min-h-[200px] flex-col justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center">
              <p className="text-[15px] text-[var(--text-secondary)]">Select an entry to see details.</p>
            </div>
          </div>
        </div>
      );
    }
    const isReceipt = selectedRow.transaction_type === "receipt";
    const secondary = displayMoneyPartySecondary(selectedRow);
    const headerPrimary = displayMoneyPartyPrimary(selectedRow);
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-[1] shrink-0 bg-[var(--bg-page)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {isReceipt ? "Receipt" : "Payment"}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-[18px] font-semibold leading-snug text-[var(--text-primary)]">
            {headerPrimary}
          </h2>
          {secondary ? (
            <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">{secondary}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-3 pt-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p
              className={cn(
                "font-[family-name:var(--font-mono)] text-[20px] font-semibold tabular-nums",
                isReceipt ? "text-[var(--inward)]" : "text-[var(--outward)]"
              )}
            >
              {formatIndianCurrency(selectedRow.amount)}
            </p>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              {formatMoneyListDate(selectedRow.occurred_at)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {paymentMethodLabel(selectedRow.payment_method)}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-tertiary)]">
              Ref: {displayMoneyReference(selectedRow)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!accessLoaded || !canManageMoney) {
    return <div className="min-h-[200px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />;
  }

  return (
    <DashboardPageShell
      title="Money"
      chromeVariant="titleOnly"
      searchPlaceholder="Search by reference, party, method, date…"
      chips={MONEY_FILTER_CHIPS}
      chipActiveId={chip}
      onChipChange={(id) => setChip(id as ChipId)}
      desktopActions={desktopActions}
      moneyFabEnabled={canManageMoney}
      fabActionOnSelect={(id) => {
        if (offline) {
          toast.error("Connect once to record money.");
          return;
        }
        if (id === "add_receipt") openReceiptForm();
        if (id === "add_payment") openPaymentForm();
      }}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      searchAccessory={searchAccessory}
    >
      {!warehouseId ? (
        <p className="text-[15px] text-[var(--text-secondary)]">Select a warehouse to see money activity.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-0 sm:min-h-0 sm:overflow-hidden">
          {offline ? (
            <p className="pt-4 text-[13px] text-[var(--text-secondary)]">You’re offline. Showing saved activity from this device.</p>
          ) : null}

          {/*
          <div className="grid grid-cols-2 gap-2.5 pt-4">
            <DashboardKpiCard
              label="This month received"
              value={kpis ? formatIndianCurrency(kpis.received) : "—"}
              sub={kpis ? `${kpis.rCount} receipts recorded` : "Loading totals…"}
              accentClass="text-[var(--inward)]"
            />
            <DashboardKpiCard
              label="This month paid"
              value={kpis ? formatIndianCurrency(kpis.paid) : "—"}
              sub={kpis ? `${kpis.pCount} payments recorded` : "Loading totals…"}
              accentClass="text-[var(--outward)]"
            />
          </div>
          */}

          <div ref={listScrollContainerRef} className="flex min-h-0 flex-1 flex-col gap-4 pt-4 sm:hidden">
            <DashboardSectionHeader label="Recent activity" />
            {listBlock({ forDesktopPane: false })}
          </div>

          {warehouseId ? (
            <div className="hidden min-h-0 flex-1 flex-col overflow-hidden sm:flex">
              {showDesktopSplitSkeleton ? (
                <DesktopMoneySplitSkeleton />
              ) : (
                <DesktopEntityTabSplit
                  detailsOpen={pane3Open}
                  list={
                    <>
                      <DesktopListPaneChrome
                        searchPlaceholder="Search by reference, party, method, date…"
                        searchValue={searchInput}
                        onSearchChange={setSearchInput}
                        searchAccessory={searchAccessory}
                        chips={MONEY_FILTER_CHIPS}
                        chipActiveId={chip}
                        onChipChange={(id) => setChip(id as ChipId)}
                        detailsOpen={pane3Open}
                        onToggleDetails={() => setPane3Open((v) => !v)}
                      />
                      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div
                          ref={desktopListScrollRef}
                          className="relative z-0 min-h-0 flex-1 overflow-y-auto pb-3 pr-4 pt-2"
                        >
                          {listBlock({ forDesktopPane: true })}
                        </div>
                        {receiptFormOpen || paymentFormOpen ? (
                          <div
                            className="pointer-events-auto absolute inset-0 z-[1] bg-[var(--bg-page)]/60"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    </>
                  }
                  details={
                    <div
                      className={cn(
                        "sr-side-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-page)] pl-4 pt-1",
                        pane3Open ? "sr-side-fade-in" : "sr-side-fade-out"
                      )}
                    >
                      {detailsBody()}
                    </div>
                  }
                />
              )}
            </div>
          ) : null}
        </div>
      )}

      <FormSidebar
        open={receiptFormOpen && Boolean(warehouseId) && !offline && !wide}
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
              window.dispatchEvent(new CustomEvent(MONEY_REFRESH_EVENT));
              scrollListToTop();
            }}
          />
        ) : null}
      </FormSidebar>
      <FormSidebar
        open={paymentFormOpen && Boolean(warehouseId) && !offline && !wide}
        title="Add Payment"
        onClose={() => setPaymentFormOpen(false)}
      >
        {warehouseId ? (
          <AddPaymentForm
            variant="sidebar"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setPaymentFormOpen(false)}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent(MONEY_REFRESH_EVENT));
              scrollListToTop();
            }}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
