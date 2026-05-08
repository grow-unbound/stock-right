"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PackageMinus, PackagePlus, SearchX } from "lucide-react";
import {
  applyStockTabClientFilters,
  countStockMovements,
  fetchStockTabKpis,
  formatLotStatusLabel,
  formatStockActivityDate,
  isStockTabFilterId,
  listStockMovements,
  mergeUniqueStockRows,
  readStockTabCache,
  stockMovementRowKey,
  stockSortColumnSchema,
  stockTabCacheKey,
  STOCK_TAB_FILTER_CHIPS,
  STOCK_TAB_SEARCH_PLACEHOLDER,
  writeStockTabCache,
  type StockMovementRow,
  type StockSortColumn,
  type StockTabFilterId,
  type StockTabKpis,
} from "@stockright/shared/stock-tab";
import { DEMO_FAB_STOCK_ACTIONS } from "@stockright/shared/demo";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { LandingFabActionSheet } from "@/components/dashboard/LandingFabActionSheet";
import { StockActivityTable } from "@/components/stock/StockActivityTable";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STROKE = 2;

const MOBILE_PAGE_SIZE = 15;

function movementLabel(row: StockMovementRow): string {
  return row.transaction_type === "lodgement" ? "Inward" : "Outward";
}

function formatBags(n: number): string {
  return n.toLocaleString("en-IN");
}

type DesktopStockSheet = "lot" | "delivery" | null;

function StockListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
      ))}
    </div>
  );
}

const webStockCacheAdapter = {
  getItem: async (key: string) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
};

export default function StockPage() {
  const { context } = useSessionUser();
  const warehouseId = context?.warehouseId ?? null;
  const offline = useIsOffline();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [filterId, setFilterId] = useState<StockTabFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);

  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopPageSize, setDesktopPageSize] = useState(20);
  const [sortColumn, setSortColumn] = useState<StockSortColumn>("tx_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [wide, setWide] = useState(true);
  const [localData, setLocalData] = useState<StockMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<StockTabKpis | null>(null);
  const kpisRef = useRef<StockTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);

  const prevDesktopSearchRef = useRef<string | null>(null);
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevDesktopFilterRef = useRef<StockTabFilterId | null>(null);
  const prevMobileFilterRef = useRef<StockTabFilterId | null>(null);

  const localDataRef = useRef<StockMovementRow[]>([]);
  localDataRef.current = localData;

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [desktopSheet, setDesktopSheet] = useState<DesktopStockSheet>(null);

  const cacheKey = useMemo(
    () => (warehouseId ? stockTabCacheKey(warehouseId) : null),
    [warehouseId]
  );

  const searchResults = useMemo(
    () => applyStockTabClientFilters(localData, filterId, searchInput),
    [localData, filterId, searchInput]
  );

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
    prevDesktopFilterRef.current = null;
    prevMobileFilterRef.current = null;
    setLoadError(null);
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId || offline) return;
    let cancelled = false;
    void (async () => {
      try {
        const k = await fetchStockTabKpis(supabase, warehouseId);
        if (!cancelled) setKpis(k);
      } catch {
        if (!cancelled) setKpis(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warehouseId, offline, supabase]);

  useEffect(() => {
    if (!warehouseId || !offline || !cacheKey) return;

    let cancelled = false;
    void (async () => {
      const cached = await readStockTabCache(webStockCacheAdapter, cacheKey);
      if (cancelled) return;
      setDataSource(cached ? "cache" : "network");
      if (cached) {
        setKpis(cached.kpis);
        setLocalData(cached.baselineMovements);
        setTotalCount(cached.baselineMovements.length);
      } else {
        setKpis(null);
        setLocalData([]);
        setTotalCount(0);
      }
      setInitialLoading(false);
      setDesktopLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, offline, cacheKey]);

  useEffect(() => {
    if (!warehouseId || offline || !wide) return;

    let cancelled = false;
    const search = debouncedSearch;
    const searchChanged = prevDesktopSearchRef.current !== null && prevDesktopSearchRef.current !== search;
    const filterChanged = prevDesktopFilterRef.current !== null && prevDesktopFilterRef.current !== filterId;
    prevDesktopSearchRef.current = search;
    prevDesktopFilterRef.current = filterId;
    if (searchChanged || filterChanged) {
      setDesktopPage(1);
      setMobilePage(1);
    }
    const desktopPageToFetch = searchChanged || filterChanged ? 1 : desktopPage;

    if (localDataRef.current.length === 0) {
      setDesktopLoading(true);
    }
    if (search !== "") setRemoteSearchPending(true);
    setLoadError(null);

    void (async () => {
      try {
        const [count, rows] = await Promise.all([
          countStockMovements(supabase, {
            warehouseId,
            search,
            filterId,
          }),
          listStockMovements(supabase, {
            warehouseId,
            search,
            filterId,
            sortColumn,
            sortDirection,
            page: desktopPageToFetch,
            pageSize: desktopPageSize,
          }),
        ]);
        if (cancelled) return;
        setTotalCount(count);
        setLocalData(rows);
        setDataSource("network");

        const k = kpisRef.current;
        if (cacheKey && desktopPageToFetch === 1 && search === "") {
          void writeStockTabCache(webStockCacheAdapter, cacheKey, {
            baselineMovements: rows,
            kpis: k ?? null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load stock";
          setLoadError(msg);
          const cached = cacheKey ? await readStockTabCache(webStockCacheAdapter, cacheKey) : null;
          if (cached) {
            setDataSource("cache");
            setKpis(cached.kpis);
            setLocalData(
              applyStockTabClientFilters(cached.baselineMovements, filterId, searchInput)
            );
            setTotalCount(
              applyStockTabClientFilters(cached.baselineMovements, filterId, debouncedSearch).length
            );
          }
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
    offline,
    wide,
    filterId,
    debouncedSearch,
    desktopPage,
    desktopPageSize,
    sortColumn,
    sortDirection,
    supabase,
    cacheKey,
    searchInput,
  ]);

  useEffect(() => {
    if (!warehouseId || offline || wide) return;

    let cancelled = false;
    const search = debouncedSearch;
    const searchChanged = prevMobileSearchRef.current !== null && prevMobileSearchRef.current !== search;
    const filterChanged = prevMobileFilterRef.current !== null && prevMobileFilterRef.current !== filterId;
    prevMobileSearchRef.current = search;
    prevMobileFilterRef.current = filterId;
    if (searchChanged || filterChanged) {
      setMobilePage(1);
    }
    const mobilePageToFetch = searchChanged || filterChanged ? 1 : mobilePage;

    const loadingMore = mobilePageToFetch > 1;
    if (loadingMore) setMobileLoadingMore(true);
    if (search !== "") setRemoteSearchPending(true);
    if (mobilePageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }
    setLoadError(null);

    void (async () => {
      try {
        if (mobilePageToFetch === 1) {
          const c = await countStockMovements(supabase, {
            warehouseId,
            search,
            filterId,
          });
          if (cancelled) return;
          setTotalCount(c);
        }

        const rows = await listStockMovements(supabase, {
          warehouseId,
          search,
          filterId,
          sortColumn: "tx_date",
          sortDirection: "desc",
          page: mobilePageToFetch,
          pageSize: MOBILE_PAGE_SIZE,
        });

        if (cancelled) return;

        const k = kpisRef.current;

        setLocalData((prev) => {
          const next = mobilePageToFetch === 1 ? rows : mergeUniqueStockRows(prev, rows);
          if (cacheKey && search === "") {
            void writeStockTabCache(webStockCacheAdapter, cacheKey, {
              baselineMovements: next,
              kpis: k ?? null,
            });
          }
          return next;
        });
        setDataSource("network");
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load stock";
          setLoadError(msg);
          const cached = cacheKey ? await readStockTabCache(webStockCacheAdapter, cacheKey) : null;
          if (cached) {
            setDataSource("cache");
            setKpis(cached.kpis);
            setLocalData(
              applyStockTabClientFilters(cached.baselineMovements, filterId, searchInput)
            );
            setTotalCount(
              applyStockTabClientFilters(cached.baselineMovements, filterId, debouncedSearch).length
            );
          }
        }
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
    offline,
    wide,
    debouncedSearch,
    filterId,
    mobilePage,
    supabase,
    cacheKey,
    searchInput,
  ]);

  mobileNearEndRef.current = () => {
    if (!warehouseId || offline || mobileLoadingMore) return;
    const loaded = localData.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < mobilePage * MOBILE_PAGE_SIZE - 4) return;
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

  function handleSort(column: StockSortColumn) {
    const parsed = stockSortColumnSchema.safeParse(column);
    const col = parsed.success ? parsed.data : "tx_date";
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(
        col === "lot_number" ||
          col === "transaction_type" ||
          col === "customer_code" ||
          col === "customer_name" ||
          col === "product_name" ||
          col === "lot_status"
          ? "asc"
          : "desc"
      );
    }
    setDesktopPage(1);
  }

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

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--text-tertiary)]" aria-hidden />
    ) : null;

  const showListEmpty =
    Boolean(warehouseId) &&
    !desktopLoading &&
    !initialLoading &&
    searchResults.length === 0 &&
    !(offline && localData.length === 0);

  const showDesktopSkeleton =
    wide &&
    !!warehouseId &&
    !offline &&
    (desktopLoading || (initialLoading && localData.length === 0));

  const showMobileSkeleton =
    !wide && !!warehouseId && !offline && initialLoading && localData.length === 0;

  return (
    <DashboardPageShell
      title="Stock"
      searchPlaceholder={STOCK_TAB_SEARCH_PLACEHOLDER}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      chips={STOCK_TAB_FILTER_CHIPS}
      chipActiveId={filterId}
      onChipChange={(id) => {
        if (isStockTabFilterId(id)) setFilterId(id);
      }}
      desktopActions={desktopActions}
      searchAccessory={searchAccessory}
    >
      <div className="flex flex-col gap-4 px-0 pt-4">
        {!warehouseId ? (
          <p className="text-[15px] text-[var(--text-secondary)]">
            Select a warehouse to see stock activity.
          </p>
        ) : null}

        {warehouseId && loadError ? (
          <p className="text-[14px] text-[var(--outward)]" role="alert">
            {loadError}
            {dataSource === "cache" ? (
              <span className="text-[var(--text-secondary)]"> Showing saved data.</span>
            ) : null}
          </p>
        ) : null}

        {warehouseId ? (
          <div className="grid grid-cols-2 gap-2.5">
            {(showDesktopSkeleton || showMobileSkeleton) ? (
              <>
                <div className="h-[88px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
                <div className="h-[88px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
              </>
            ) : (
              <>
                <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Active stock
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {kpis ? `${formatBags(kpis.activeStockBags)} bags` : "—"}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {kpis ? `${formatBags(kpis.activeStockLots)} lots` : ""}
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Stale stock
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums text-[var(--pending)]">
                    {kpis ? `${formatBags(kpis.staleStockBags)} bags` : "—"}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {kpis ? `${formatBags(kpis.staleStockLots)} lots` : ""}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : null}

        {warehouseId ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Recent activity
            </p>

            <div className="hidden sm:block">
              {offline && localData.length === 0 ? (
                <p className="text-[15px] text-[var(--text-secondary)]">
                  Connect once to load stock activity on this device.
                </p>
              ) : showDesktopSkeleton ? (
                <StockListSkeleton />
              ) : showListEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : (
                <StockActivityTable
                  rows={searchResults}
                  totalCount={totalCount}
                  page={desktopPage}
                  pageSize={desktopPageSize}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  formatActivityDate={formatStockActivityDate}
                  movementLabel={movementLabel}
                  formatStatus={formatLotStatusLabel}
                  formatBagCount={formatBags}
                  onSort={handleSort}
                  onPageChange={(p) => setDesktopPage(p)}
                  onPageSizeChange={(size) => {
                    setDesktopPageSize(size);
                    setDesktopPage(1);
                  }}
                />
              )}
            </div>

            <div className="sm:hidden">
              {offline && localData.length === 0 ? (
                <p className="px-1 text-[15px] text-[var(--text-secondary)]">
                  Connect once to load stock activity on this device.
                </p>
              ) : showMobileSkeleton ? (
                <StockListSkeleton />
              ) : showListEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {searchResults.map((row) => {
                    const isLodgement = row.transaction_type === "lodgement";
                    return (
                      <li key={stockMovementRowKey(row)}>
                        <button
                          type="button"
                          className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-3 text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                        >
                          <span
                            className={cn(
                              isLodgement
                                ? "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--inward-border)] bg-[var(--inward-bg)] text-[var(--inward)]"
                                : "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--outward-border)] bg-[var(--outward-bg)] text-[var(--outward)]"
                            )}
                          >
                            {isLodgement ? (
                              <PackagePlus className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                            ) : (
                              <PackageMinus className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-[var(--text-tertiary)]">
                              {row.lot_number} · {formatStockActivityDate(row.tx_date)}
                            </span>
                            <span className="mt-0.5 block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                              {row.customer_name}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-secondary)]">
                              {row.product_name}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-[family-name:var(--font-display)] text-[22px] font-bold tabular-nums text-[var(--text-primary)]">
                              {formatBags(row.num_bags)}
                            </span>
                            <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              Bags
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mobileLoadingMore ? (
                <div className="mt-2 h-[76px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
              ) : null}
              <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
            </div>
          </>
        ) : null}
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
