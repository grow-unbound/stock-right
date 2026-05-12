"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageMinus, PackagePlus, SearchX } from "lucide-react";
import {
  applyStockTabClientFilters,
  countStockMovements,
  fetchStockTabKpis,
  formatStockActivityDate,
  isStockTabFilterId,
  listStockMovements,
  mergeUniqueStockRows,
  readStockTabCache,
  stockMovementRowKey,
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
import { STOCK_REFRESH_EVENT } from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { shouldPrefetchListScroll } from "@stockright/shared/list-scroll-prefetch";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { DesktopEntityTabSplit } from "@/components/dashboard/DesktopEntityTabSplit";
import { DesktopListPaneChrome } from "@/components/dashboard/DesktopListPaneChrome";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { StockActivityTable } from "@/components/stock/StockActivityTable";
import { AddLotForm } from "@/components/stock/add-lot/AddLotForm";
import { AddDeliveryForm } from "@/components/stock/add-delivery/AddDeliveryForm";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useListScrollPrefetch } from "@/hooks/useListScrollPrefetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STROKE = 2;
const LIST_PAGE_SIZE = 15;

function formatBags(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatLotStatusLabel(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (t === "WRITTEN_OFF") return "Written off";
  const words = raw.replace(/_/g, " ").trim().split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function DesktopStockSplitSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-0">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-[var(--border-default)]">
        <div className="flex flex-col gap-2 border-b border-[var(--border-default)] p-2">
          <div className="h-12 skeleton rounded-[var(--radius-md)]" />
          <div className="h-8 skeleton rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex flex-col gap-2 p-2 pt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[76px] skeleton rounded-[var(--radius-md)]" />
          ))}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 p-4">
        <div className="h-full min-h-[200px] skeleton rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

function StockListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[76px] skeleton rounded-[var(--radius-md)]" />
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
  const router = useRouter();
  const { context } = useSessionUser();
  const warehouseId = context?.warehouseId ?? null;
  const offline = useIsOffline();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [filterId, setFilterId] = useState<StockTabFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);

  const [wide, setWide] = useState(true);
  const [localData, setLocalData] = useState<StockMovementRow[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listLoadingMore, setListLoadingMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<StockTabKpis | null>(null);
  const kpisRef = useRef<StockTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addLotOpen, setAddLotOpen] = useState(false);
  const [addDeliveryOpen, setAddDeliveryOpen] = useState(false);
  const [addLotHeaderChipHost, setAddLotHeaderChipHost] = useState<HTMLElement | null>(null);

  const [pane3Open, setPane3Open] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [desktopTableRows, setDesktopTableRows] = useState<StockMovementRow[]>([]);
  const [desktopTableTotal, setDesktopTableTotal] = useState(0);
  const [desktopTableLoading, setDesktopTableLoading] = useState(false);
  const [stockTablePage, setStockTablePage] = useState(1);
  const [stockTablePageSize, setStockTablePageSize] = useState(LIST_PAGE_SIZE);
  const [stockTableSortColumn, setStockTableSortColumn] = useState<StockSortColumn>("tx_date");
  const [stockTableSortDirection, setStockTableSortDirection] = useState<"asc" | "desc">("desc");

  const seedRowForPane3Ref = useRef<StockMovementRow | null>(null);
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const pane3OpenRef = useRef(pane3Open);
  pane3OpenRef.current = pane3Open;
  const stockTablePageRef = useRef(stockTablePage);
  stockTablePageRef.current = stockTablePage;
  const pane3WasOpenRef = useRef(pane3Open);

  const prevSearchRef = useRef<string | null>(null);
  const prevFilterRef = useRef<StockTabFilterId | null>(null);

  const localDataRef = useRef<StockMovementRow[]>([]);
  localDataRef.current = localData;

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const desktopListScrollRef = useRef<HTMLDivElement>(null);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  const listLoadingMoreRef = useRef(false);
  listLoadingMoreRef.current = listLoadingMore;

  const cacheKey = useMemo(
    () => (warehouseId ? stockTabCacheKey(warehouseId) : null),
    [warehouseId]
  );

  useEffect(() => {
    function onStockRefresh(e: Event) {
      const ce = e as CustomEvent<StockMovementRow | undefined>;
      const row = ce.detail;
      if (!row) return;
      setLocalData((prev) => mergeUniqueStockRows([row], prev));
      if (wideRef.current && !pane3OpenRef.current && stockTablePageRef.current === 1) {
        setDesktopTableRows((prev) => mergeUniqueStockRows([row], prev));
      }
    }
    window.addEventListener(STOCK_REFRESH_EVENT, onStockRefresh);
    return () => window.removeEventListener(STOCK_REFRESH_EVENT, onStockRefresh);
  }, []);

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
    setListPage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevFilterRef.current = null;
    setLoadError(null);
    setSelectedKey(null);
  }, [warehouseId]);

  useEffect(() => {
    setListPage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevFilterRef.current = null;
  }, [wide]);

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
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, offline, cacheKey]);

  useEffect(() => {
    if (!warehouseId || offline) return;
    if (wide && !pane3Open) return;

    let cancelled = false;
    const search = debouncedSearch;
    const searchChanged = prevSearchRef.current !== null && prevSearchRef.current !== search;
    const filterChanged = prevFilterRef.current !== null && prevFilterRef.current !== filterId;
    prevSearchRef.current = search;
    prevFilterRef.current = filterId;
    if (searchChanged || filterChanged) {
      setListPage(1);
    }
    const pageToFetch = searchChanged || filterChanged ? 1 : listPage;

    const loadingMore = pageToFetch > 1;
    if (loadingMore) setListLoadingMore(true);
    if (search !== "") setRemoteSearchPending(true);
    if (pageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }
    setLoadError(null);

    void (async () => {
      try {
        if (pageToFetch === 1) {
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
          page: pageToFetch,
          pageSize: LIST_PAGE_SIZE,
        });

        if (cancelled) return;

        const k = kpisRef.current;

        setLocalData((prev) => {
          const seed = seedRowForPane3Ref.current;
          let next: StockMovementRow[];
          if (pageToFetch === 1 && seed) {
            seedRowForPane3Ref.current = null;
            next = mergeUniqueStockRows([seed], rows);
          } else {
            next = pageToFetch === 1 ? rows : mergeUniqueStockRows(prev, rows);
          }
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
    offline,
    debouncedSearch,
    filterId,
    listPage,
    supabase,
    cacheKey,
    searchInput,
    wide,
    pane3Open,
  ]);

  useEffect(() => {
    if (!warehouseId || offline || !wide || pane3Open) return;
    let cancelled = false;
    setDesktopTableLoading(true);
    const search = debouncedSearch;
    void (async () => {
      try {
        const c = await countStockMovements(supabase, {
          warehouseId,
          search,
          filterId,
        });
        if (cancelled) return;
        setDesktopTableTotal(c);
        const rows = await listStockMovements(supabase, {
          warehouseId,
          search,
          filterId,
          sortColumn: stockTableSortColumn,
          sortDirection: stockTableSortDirection,
          page: stockTablePage,
          pageSize: stockTablePageSize,
        });
        if (cancelled) return;
        setDesktopTableRows(rows);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load stock";
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) setDesktopTableLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    warehouseId,
    offline,
    wide,
    pane3Open,
    debouncedSearch,
    filterId,
    stockTablePage,
    stockTablePageSize,
    stockTableSortColumn,
    stockTableSortDirection,
    supabase,
  ]);

  useEffect(() => {
    if (!(wide && !pane3Open)) return;
    setStockTablePage(1);
  }, [debouncedSearch, filterId, wide, pane3Open]);

  useEffect(() => {
    const opened = pane3Open && !pane3WasOpenRef.current;
    pane3WasOpenRef.current = pane3Open;
    if (!opened || !wide || offline || !warehouseId) return;
    if (localDataRef.current.length > 0) return;
    setListPage(1);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevFilterRef.current = null;
  }, [pane3Open, wide, offline, warehouseId]);

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
    if ((addLotOpen || addDeliveryOpen) && wide) {
      setPane3Open(true);
      setSelectedKey(null);
    }
  }, [addLotOpen, addDeliveryOpen, wide]);

  useEffect(() => {
    if (!pane3Open) return;
    if (!searchResults.length) {
      if (!initialLoading) setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && searchResults.some((r) => stockMovementRowKey(r) === prev)) return prev;
      return stockMovementRowKey(searchResults[0]!);
    });
  }, [searchResults, pane3Open, initialLoading]);

  const selectedRow = useMemo(
    () => searchResults.find((r) => stockMovementRowKey(r) === selectedKey) ?? null,
    [searchResults, selectedKey]
  );

  const addLot = DEMO_FAB_STOCK_ACTIONS[0];
  const addDelivery = DEMO_FAB_STOCK_ACTIONS[1];

  const openAddLot = () => {
    setAddDeliveryOpen(false);
    if (wide) {
      setAddLotOpen(true);
    } else {
      router.push("/stock/lot/new");
    }
  };

  const openAddDelivery = () => {
    setAddLotOpen(false);
    if (wide) {
      setAddDeliveryOpen(true);
    } else {
      router.push("/stock/delivery/new");
    }
  };

  const desktopActions =
    addLot && addDelivery ?
      <>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={openAddLot}
        >
          {addLot.label}
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          className="min-w-[var(--cta-tab-min-width)] justify-center"
          onClick={openAddDelivery}
        >
          {addDelivery.label}
        </Button>
      </>
    : null;

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--text-tertiary)]" aria-hidden />
    ) : null;

  const showListEmpty =
    Boolean(warehouseId) &&
    !initialLoading &&
    searchResults.length === 0 &&
    !(offline && localData.length === 0);

  const showMobileSkeleton =
    !wide && !!warehouseId && !offline && initialLoading && localData.length === 0;

  const showDesktopListSkeleton =
    wide && !!warehouseId && !offline && pane3Open && initialLoading && localData.length === 0;
  const showDesktopTableSkeleton =
    wide && !!warehouseId && !offline && !pane3Open && desktopTableLoading && desktopTableRows.length === 0;
  const showDesktopSplitSkeleton = showDesktopListSkeleton || showDesktopTableSkeleton;

  function scrollListToTop() {
    desktopListScrollRef.current && (desktopListScrollRef.current.scrollTop = 0);
    listScrollContainerRef.current && (listScrollContainerRef.current.scrollTop = 0);
    if (!wide) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleStockTableSort(column: StockSortColumn) {
    if (column === stockTableSortColumn) {
      setStockTableSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setStockTableSortColumn(column);
      setStockTableSortDirection("desc");
    }
    setStockTablePage(1);
  }

  const listBlock = (opts: { forDesktopPane: boolean }) => {
    const inDesktop = opts.forDesktopPane;

    if (inDesktop && wide && !pane3Open) {
      if (offline) {
        return (
          <p className="text-[15px] text-[var(--text-secondary)]">
            Connect once to load stock activity on this device.
          </p>
        );
      }
      if (!desktopTableLoading && desktopTableTotal === 0) {
        return (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center"
            )}
          >
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">
              No matches. Try a different search or filter.
            </p>
          </div>
        );
      }
      return (
        <StockActivityTable
          rows={desktopTableRows}
          totalCount={desktopTableTotal}
          page={stockTablePage}
          pageSize={stockTablePageSize}
          sortColumn={stockTableSortColumn}
          sortDirection={stockTableSortDirection}
          formatActivityDate={formatStockActivityDate}
          movementLabel={(row) => (row.transaction_type === "lodgement" ? "Receive" : "Dispatch")}
          formatStatus={formatLotStatusLabel}
          formatBagCount={formatBags}
          onSort={handleStockTableSort}
          onPageChange={setStockTablePage}
          onPageSizeChange={(size) => {
            setStockTablePageSize(size);
            setStockTablePage(1);
          }}
          onRowClick={(row) => {
            seedRowForPane3Ref.current = row;
            setSelectedKey(stockMovementRowKey(row));
            setPane3Open(true);
          }}
        />
      );
    }

    return (
      <>
        {offline && localData.length === 0 ? (
          <p className={cn("text-[15px] text-[var(--text-secondary)]", !inDesktop && "px-1")}>
            Connect once to load stock activity on this device.
          </p>
        ) : (inDesktop ? showDesktopListSkeleton : showMobileSkeleton) ? (
          <StockListSkeleton />
        ) : showListEmpty ? (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 text-center",
              inDesktop ? "py-10" : "py-10"
            )}
          >
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">
              No matches. Try a different search or filter.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {searchResults.map((row) => {
              const isLodgement = row.transaction_type === "lodgement";
              const k = stockMovementRowKey(row);
              return (
                <li key={k}>
                  <RegisterListRow
                    as="button"
                    selected={selectedKey === k && !addLotOpen && !addDeliveryOpen}
                    onClick={() => {
                      setSelectedKey(k);
                      if (!pane3Open) setPane3Open(true);
                    }}
                    icon={
                      isLodgement ? (
                        <PackagePlus className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                      ) : (
                        <PackageMinus className="size-[18px]" strokeWidth={STROKE} aria-hidden />
                      )
                    }
                    iconShellClassName={
                      isLodgement
                        ? "bg-[var(--inward-bg)] text-[var(--inward)]"
                        : "bg-[var(--outward-bg)] text-[var(--outward)]"
                    }
                    meta={
                      <>
                        {row.lot_number} · {formatStockActivityDate(row.tx_date)}
                      </>
                    }
                    title={row.customer_name}
                    detail={row.product_name}
                    trailing={
                      <span
                        className={cn(
                          "text-[14px] font-semibold tabular-nums",
                          isLodgement ? "text-[var(--inward)]" : "text-[var(--outward)]"
                        )}
                      >
                        {isLodgement ? "+" : "−"}
                        {formatBags(row.num_bags)} bags
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {listLoadingMore ? (
          <div className="mt-2 h-[76px] skeleton rounded-[var(--radius-md)]" />
        ) : null}
        {!inDesktop ? <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden /> : null}
      </>
    );
  };

  const detailsBody = () => {
    if (addLotOpen && wide) {
      return warehouseId ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AddLotForm
            layoutVariant="detailPane"
            title="Add lot"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddLotOpen(false)}
            onSuccess={(row) => {
              if (row) {
                setLocalData((prev) => mergeUniqueStockRows([row], prev));
                setSelectedKey(stockMovementRowKey(row));
              }
              setAddLotOpen(false);
              scrollListToTop();
              setPane3Open(true);
            }}
          />
        </div>
      ) : null;
    }
    if (addDeliveryOpen && wide) {
      return warehouseId ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AddDeliveryForm
            layoutVariant="detailPane"
            title="Add Delivery"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddDeliveryOpen(false)}
            onSuccess={(row) => {
              if (row) {
                setLocalData((prev) => mergeUniqueStockRows([row], prev));
                setSelectedKey(stockMovementRowKey(row));
              }
              setAddDeliveryOpen(false);
              scrollListToTop();
              setPane3Open(true);
            }}
          />
        </div>
      ) : null;
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
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-[1] shrink-0 bg-[var(--bg-page)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {selectedRow.lot_number}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-3 pt-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Lot details
            </p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{selectedRow.customer_name}</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{selectedRow.product_name}</p>
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
              {selectedRow.transaction_type === "lodgement" ? "Receive" : "Dispatch"} ·{" "}
              {formatStockActivityDate(selectedRow.tx_date)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardPageShell
      title="Stock"
      chromeVariant="titleOnly"
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
      fabActionOnSelect={(id) => {
        if (id === "add_lot") openAddLot();
        if (id === "add_delivery") openAddDelivery();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col px-0 sm:min-h-0 sm:overflow-hidden">
        {!warehouseId ? (
          <p className="pt-4 text-[15px] text-[var(--text-secondary)]">
            Select a warehouse to see stock activity.
          </p>
        ) : null}

        {warehouseId && loadError ? (
          <p className="pt-4 text-[14px] text-[var(--outward)]" role="alert">
            {loadError}
            {dataSource === "cache" ? (
              <span className="text-[var(--text-secondary)]"> Showing saved data.</span>
            ) : null}
          </p>
        ) : null}

        {/*
        {warehouseId ? (
          <div className="grid grid-cols-2 gap-2.5">
            <DashboardKpiCard
              label="Active stock"
              value={kpis ? `${formatBags(kpis.activeStockBags)} bags` : "—"}
              sub={kpis ? `${formatBags(kpis.activeStockLots)} lots` : ""}
              accentClass="text-[var(--text-primary)]"
            />
            <DashboardKpiCard
              label="Stale stock"
              value={kpis ? `${formatBags(kpis.staleStockBags)} bags` : "—"}
              sub={kpis ? `${formatBags(kpis.staleStockLots)} lots` : ""}
              accentClass="text-[var(--pending)]"
            />
          </div>
        ) : null}
        */}

        <div ref={listScrollContainerRef} className="sm:hidden flex min-h-0 flex-1 flex-col gap-4 pt-4">
          {warehouseId ? (
            <>
              <DashboardSectionHeader label="Recent activity" />
              {listBlock({ forDesktopPane: false })}
            </>
          ) : null}
        </div>

        {warehouseId ? (
          <div className="hidden min-h-0 flex-1 flex-col overflow-hidden sm:flex">
            {showDesktopSplitSkeleton ? (
              <DesktopStockSplitSkeleton />
            ) : (
              <DesktopEntityTabSplit detailsOpen={pane3Open} list={
                <>
                  <DesktopListPaneChrome
                    searchPlaceholder={STOCK_TAB_SEARCH_PLACEHOLDER}
                    searchValue={searchInput}
                    onSearchChange={setSearchInput}
                    searchAccessory={searchAccessory}
                    chips={STOCK_TAB_FILTER_CHIPS}
                    chipActiveId={filterId}
                    onChipChange={(id) => {
                      if (isStockTabFilterId(id)) setFilterId(id);
                    }}
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
                    {addLotOpen || addDeliveryOpen ? (
                      <div
                        className="pointer-events-auto absolute inset-0 z-[1] bg-[var(--bg-page)]/60"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </>
              } details={
                <div
                  className={cn(
                    "sr-side-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-page)] pl-4 pt-1",
                    pane3Open ? "sr-side-fade-in" : "sr-side-fade-out"
                  )}
                >
                  {detailsBody()}
                </div>
              } />
            )}
          </div>
        ) : null}
      </div>

      <FormSidebar
        open={addLotOpen && Boolean(warehouseId) && !offline && !wide}
        title="Add Lot"
        onClose={() => setAddLotOpen(false)}
        onTitleAccessoryHostReady={setAddLotHeaderChipHost}
      >
        {warehouseId ? (
          <AddLotForm
            layoutVariant="sidebar"
            headerLotChipHost={addLotHeaderChipHost}
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddLotOpen(false)}
            onSuccess={(row) => {
              if (row) setLocalData((prev) => mergeUniqueStockRows([row], prev));
            }}
          />
        ) : null}
      </FormSidebar>
      <FormSidebar
        open={addDeliveryOpen && Boolean(warehouseId) && !offline && !wide}
        title="Add Delivery"
        onClose={() => setAddDeliveryOpen(false)}
      >
        {warehouseId ? (
          <AddDeliveryForm
            layoutVariant="sidebar"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddDeliveryOpen(false)}
            onSuccess={(row) => {
              if (row) setLocalData((prev) => mergeUniqueStockRows([row], prev));
            }}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
