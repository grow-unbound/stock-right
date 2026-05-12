"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SearchX, User } from "lucide-react";
import {
  applyPartiesTabClientFilters,
  buildPartiesTabVisibleRows,
  countPartiesTab,
  fetchPartiesTabKpis,
  isPartiesTabFilterId,
  listPartiesTab,
  mergeUniquePartyRows,
  PARTIES_TAB_FILTER_CHIPS,
  PARTIES_TAB_SEARCH_PLACEHOLDER,
  partiesTabCacheKey,
  partyRowKey,
  readPartiesTabCache,
  type PartiesTabFilterId,
  type PartiesTabKpis,
  type PartiesTabListRow,
  writePartiesTabCache,
} from "@stockright/shared/parties-tab";
import { DEMO_FAB_PARTIES_ACTIONS } from "@stockright/shared/demo";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { shouldPrefetchListScroll } from "@stockright/shared/list-scroll-prefetch";
import { PARTIES_REFRESH_EVENT } from "@stockright/shared/api";
import { formatIndianCurrency } from "@stockright/shared/utils";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { DesktopEntityTabSplit } from "@/components/dashboard/DesktopEntityTabSplit";
import { DesktopListPaneChrome } from "@/components/dashboard/DesktopListPaneChrome";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { PartiesActivityTable } from "@/components/parties/PartiesActivityTable";
import { AddPartyForm } from "@/components/parties/add-party/AddPartyForm";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useListScrollPrefetch } from "@/hooks/useListScrollPrefetch";
import { webPartiesTabCacheAdapter } from "@/lib/parties-app-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STROKE = 2;
const LIST_PAGE_SIZE = 15;

function formatBags(n: number): string {
  return n.toLocaleString("en-IN");
}

function PartyListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-[72px] skeleton rounded-[var(--radius-md)]" />
      ))}
    </ul>
  );
}

function DesktopPartiesSplitSkeleton() {
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

function partyLotSummaryLine(row: PartiesTabListRow): string {
  const totalLots = row.lots_active + row.lots_stale + row.lots_delivered;
  const lotWord = totalLots === 1 ? "lot" : "Lots";
  return `${totalLots} ${lotWord} · ${formatBags(row.bags_active_stale_delivered)} Bags`;
}

export default function PartiesPage() {
  const router = useRouter();
  const { context } = useSessionUser();
  const warehouseId = context?.warehouseId ?? null;
  const offline = useIsOffline();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [filterId, setFilterId] = useState<PartiesTabFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const [wide, setWide] = useState(true);
  const [localData, setLocalData] = useState<PartiesTabListRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<PartiesTabListRow[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listLoadingMore, setListLoadingMore] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<PartiesTabKpis | null>(null);
  const kpisRef = useRef<PartiesTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addPartyOpen, setAddPartyOpen] = useState(false);

  const [pane3Open, setPane3Open] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [desktopTableRows, setDesktopTableRows] = useState<PartiesTabListRow[]>([]);
  const [desktopTableTotal, setDesktopTableTotal] = useState(0);
  const [desktopTableLoading, setDesktopTableLoading] = useState(false);
  const [partiesTablePage, setPartiesTablePage] = useState(1);
  const [partiesTablePageSize, setPartiesTablePageSize] = useState(LIST_PAGE_SIZE);

  const seedPartyForPane3Ref = useRef<PartiesTabListRow | null>(null);
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const pane3OpenRef = useRef(pane3Open);
  pane3OpenRef.current = pane3Open;
  const partiesTablePageRef = useRef(partiesTablePage);
  partiesTablePageRef.current = partiesTablePage;
  const pane3WasOpenRef = useRef(pane3Open);

  const localDataRef = useRef<PartiesTabListRow[]>([]);
  localDataRef.current = localData;
  const prevSearchRef = useRef<string | null>(null);
  const prevFilterRef = useRef<PartiesTabFilterId | null>(null);

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const desktopListScrollRef = useRef<HTMLDivElement>(null);
  const listLoadingMoreRef = useRef(false);
  listLoadingMoreRef.current = listLoadingMore;

  const cacheKey = useMemo(
    () => (warehouseId ? partiesTabCacheKey(warehouseId) : null),
    [warehouseId]
  );

  useEffect(() => {
    function onPartiesRefresh(e: Event) {
      const ce = e as CustomEvent<PartiesTabListRow | undefined>;
      const row = ce.detail;
      if (!row) return;
      setLocalData((prev) => mergeUniquePartyRows([row], prev));
      setBaselineRows((prev) => mergeUniquePartyRows([row], prev));
      if (wideRef.current && !pane3OpenRef.current && partiesTablePageRef.current === 1) {
        setDesktopTableRows((prev) => mergeUniquePartyRows([row], prev));
      }
    }
    window.addEventListener(PARTIES_REFRESH_EVENT, onPartiesRefresh);
    return () => window.removeEventListener(PARTIES_REFRESH_EVENT, onPartiesRefresh);
  }, []);

  const mobileSearchResults = useMemo(
    () =>
      buildPartiesTabVisibleRows({
        baselineRows,
        serverRows: localData,
        filterId,
        searchInputRaw: searchInput,
      }),
    [baselineRows, localData, filterId, searchInput]
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
    setBaselineRows([]);
    setInitialLoading(true);
    prevSearchRef.current = null;
    prevFilterRef.current = null;
    setLoadError(null);
    setSelectedKey(null);
  }, [warehouseId]);

  useEffect(() => {
    setListPage(1);
    setLocalData([]);
    setBaselineRows([]);
    prevSearchRef.current = null;
    prevFilterRef.current = null;
  }, [wide]);

  useEffect(() => {
    if (!warehouseId || offline) return;
    let cancelled = false;
    void (async () => {
      try {
        const k = await fetchPartiesTabKpis(supabase, warehouseId);
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
      const cached = await readPartiesTabCache(webPartiesTabCacheAdapter, cacheKey);
      if (cancelled) return;
      setDataSource(cached ? "cache" : "network");
      if (cached) {
        setKpis(cached.kpis);
        setLocalData(cached.baselineRows);
        setBaselineRows(cached.baselineRows);
        setTotalCount(cached.baselineRows.length);
      } else {
        setKpis(null);
        setLocalData([]);
        setBaselineRows([]);
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
    if (debouncedSearch !== "") setRemoteSearchPending(true);
    if (pageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }
    setLoadError(null);

    void (async () => {
      try {
        if (pageToFetch === 1) {
          const c = await countPartiesTab(supabase, {
            warehouseId,
            search,
            filterId,
          });
          if (cancelled) return;
          setTotalCount(c);
        }

        const rows = await listPartiesTab(supabase, {
          warehouseId,
          search,
          filterId,
          page: pageToFetch,
          pageSize: LIST_PAGE_SIZE,
        });

        if (cancelled) return;

        const k = kpisRef.current;

        setLocalData((prev) => {
          const seed = seedPartyForPane3Ref.current;
          let next: PartiesTabListRow[];
          if (pageToFetch === 1 && seed) {
            seedPartyForPane3Ref.current = null;
            next = mergeUniquePartyRows([seed], rows);
          } else {
            next = pageToFetch === 1 ? rows : mergeUniquePartyRows(prev, rows);
          }
          if (cacheKey && search === "") {
            void writePartiesTabCache(webPartiesTabCacheAdapter, cacheKey, {
              baselineRows: next,
              kpis: k ?? null,
            });
          }
          return next;
        });

        if (filterId === "all" && search === "") {
          setBaselineRows((prev) =>
            pageToFetch === 1 ? mergeUniquePartyRows([], rows) : mergeUniquePartyRows(prev, rows)
          );
        }

        setDataSource("network");
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load parties";
          setLoadError(msg);
          const cached = cacheKey ? await readPartiesTabCache(webPartiesTabCacheAdapter, cacheKey) : null;
          if (cached) {
            setDataSource("cache");
            setKpis(cached.kpis);
            const needle = searchInputRef.current;
            setLocalData(applyPartiesTabClientFilters(cached.baselineRows, filterId, needle));
            setBaselineRows(cached.baselineRows);
            setTotalCount(applyPartiesTabClientFilters(cached.baselineRows, filterId, debouncedSearch).length);
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
  }, [warehouseId, offline, debouncedSearch, filterId, listPage, supabase, cacheKey, wide, pane3Open]);

  useEffect(() => {
    if (!warehouseId || offline || !wide || pane3Open) return;
    let cancelled = false;
    setDesktopTableLoading(true);
    const search = debouncedSearch;
    void (async () => {
      try {
        const c = await countPartiesTab(supabase, {
          warehouseId,
          search,
          filterId,
        });
        if (cancelled) return;
        setDesktopTableTotal(c);
        const rows = await listPartiesTab(supabase, {
          warehouseId,
          search,
          filterId,
          page: partiesTablePage,
          pageSize: partiesTablePageSize,
        });
        if (cancelled) return;
        setDesktopTableRows(rows);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load parties";
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
    partiesTablePage,
    partiesTablePageSize,
    supabase,
  ]);

  useEffect(() => {
    if (!(wide && !pane3Open)) return;
    setPartiesTablePage(1);
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

  mobileNearEndRef.current = () => {
    if (!warehouseId || offline || wide || listLoadingMore) return;
    const loaded = localData.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < listPage * LIST_PAGE_SIZE - 4) return;
    setListPage((p) => p + 1);
  };

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
    if (addPartyOpen && wide) {
      setPane3Open(true);
      setSelectedKey(null);
    }
  }, [addPartyOpen, wide]);

  useEffect(() => {
    if (!pane3Open) return;
    if (!mobileSearchResults.length) {
      if (!initialLoading) setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && mobileSearchResults.some((r) => partyRowKey(r) === prev)) return prev;
      return partyRowKey(mobileSearchResults[0]!);
    });
  }, [mobileSearchResults, pane3Open, initialLoading]);

  const selectedRow = useMemo(
    () => mobileSearchResults.find((r) => partyRowKey(r) === selectedKey) ?? null,
    [mobileSearchResults, selectedKey]
  );

  const addParty = DEMO_FAB_PARTIES_ACTIONS[0];

  const openAddParty = () => {
    if (wide) {
      setAddPartyOpen(true);
    } else {
      router.push("/parties/new");
    }
  };

  const desktopActions = addParty ? (
    <Button
      variant="primary"
      size="sm"
      type="button"
      className="min-w-[var(--cta-tab-min-width)] justify-center"
      onClick={openAddParty}
    >
      {addParty.label}
    </Button>
  ) : null;

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--text-tertiary)]" aria-hidden />
    ) : null;

  const showListEmpty =
    Boolean(warehouseId) &&
    !initialLoading &&
    mobileSearchResults.length === 0 &&
    !(offline && localData.length === 0);

  const showMobileSkeleton =
    !wide && !!warehouseId && !offline && initialLoading && localData.length === 0;

  const showDesktopListSkeleton =
    wide && !!warehouseId && !offline && pane3Open && initialLoading && localData.length === 0;
  const showDesktopTableSkeleton =
    wide && !!warehouseId && !offline && !pane3Open && desktopTableLoading && desktopTableRows.length === 0;
  const showDesktopSplitSkeleton = showDesktopListSkeleton || showDesktopTableSkeleton;

  function scrollListToTop() {
    if (desktopListScrollRef.current) desktopListScrollRef.current.scrollTop = 0;
    if (!wide) window.scrollTo({ top: 0, behavior: "auto" });
  }

  const listBlock = (forDesktopPane: boolean) => {
    const inDesktop = forDesktopPane;

    if (inDesktop && wide && !pane3Open) {
      if (offline) {
        return (
          <p className="text-[15px] text-[var(--text-secondary)]">
            Connect once to load parties on this device.
          </p>
        );
      }
      if (!desktopTableLoading && desktopTableTotal === 0) {
        return (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center",
              inDesktop && "py-12"
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
        <PartiesActivityTable
          rows={desktopTableRows}
          totalCount={desktopTableTotal}
          page={partiesTablePage}
          pageSize={partiesTablePageSize}
          onPageChange={setPartiesTablePage}
          onPageSizeChange={(size) => {
            setPartiesTablePageSize(size);
            setPartiesTablePage(1);
          }}
          onRowClick={(row) => {
            seedPartyForPane3Ref.current = row;
            setSelectedKey(partyRowKey(row));
            setPane3Open(true);
          }}
        />
      );
    }

    return (
      <>
        {offline && localData.length === 0 ? (
          <p className={cn("text-[15px] text-[var(--text-secondary)]", !inDesktop && "px-1")}>
            Connect once to load parties on this device.
          </p>
        ) : (inDesktop ? showDesktopListSkeleton : showMobileSkeleton) ? (
          <PartyListSkeleton />
        ) : showListEmpty ? (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center",
              inDesktop && "py-12"
            )}
          >
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">
              No matches. Try a different search or filter.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {mobileSearchResults.map((row) => {
              const k = partyRowKey(row);
              return (
                <li key={k}>
                  <RegisterListRow
                    as="button"
                    selected={selectedKey === k && !addPartyOpen}
                    onClick={() => {
                      setSelectedKey(k);
                      if (!pane3Open) setPane3Open(true);
                    }}
                    icon={<User className="size-[18px]" strokeWidth={STROKE} aria-hidden />}
                    iconShellClassName="bg-[var(--brand-subtle)] text-[var(--brand-text)]"
                    meta={row.customer_code}
                    title={row.customer_name}
                    detail={
                      <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                        {partyLotSummaryLine(row)}
                      </span>
                    }
                    trailing={
                      <span className="text-[14px] font-semibold tabular-nums text-[var(--pending)]">
                        {formatIndianCurrency(row.outstanding_total)}
                      </span>
                    }
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
    if (addPartyOpen && wide) {
      return warehouseId ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AddPartyForm
            layoutVariant="detailPane"
            title="Add party"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddPartyOpen(false)}
            onSuccess={(row) => {
              if (row) {
                setLocalData((prev) => mergeUniquePartyRows([row], prev));
                setBaselineRows((prev) => mergeUniquePartyRows([row], prev));
                setSelectedKey(partyRowKey(row));
              }
              setAddPartyOpen(false);
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
              <p className="text-[15px] text-[var(--text-secondary)]">Select a party to see details.</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-[1] shrink-0 bg-[var(--bg-page)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {selectedRow.customer_name}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-3 pt-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Party</p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-[14px] text-[var(--text-secondary)]">
              {selectedRow.customer_code}
            </p>
            <p className="mt-3 text-[15px] font-semibold tabular-nums text-[var(--pending)]">
              {formatIndianCurrency(selectedRow.outstanding_total)} outstanding
            </p>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{partyLotSummaryLine(selectedRow)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardPageShell
      title="Parties"
      chromeVariant="titleOnly"
      searchPlaceholder={PARTIES_TAB_SEARCH_PLACEHOLDER}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      chips={PARTIES_TAB_FILTER_CHIPS}
      chipActiveId={filterId}
      onChipChange={(id) => {
        if (isPartiesTabFilterId(id)) setFilterId(id);
      }}
      desktopActions={desktopActions}
      searchAccessory={searchAccessory}
      fabActionOnSelect={(id) => {
        if (id !== "add_party") return;
        openAddParty();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col px-0 sm:min-h-0 sm:overflow-hidden">
        {!warehouseId ? (
          <p className="pt-4 text-[15px] text-[var(--text-secondary)]">Select a warehouse to see parties.</p>
        ) : null}

        {warehouseId && offline ? (
          <p className="pt-4 text-[13px] text-[var(--text-secondary)]">
            You are offline. Showing saved parties from this device.
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
          <div className="grid grid-cols-2 gap-2.5 pt-4">
            <DashboardKpiCard ... />
            <DashboardKpiCard ... />
          </div>
        ) : null}
        */}

        <div className="sm:hidden flex min-h-0 flex-1 flex-col gap-4 pt-4">
          {warehouseId ? (
            <>
              <DashboardSectionHeader label="Maximum outstanding" />
              {listBlock(false)}
            </>
          ) : null}
        </div>

        {warehouseId ? (
          <div className="hidden min-h-0 flex-1 flex-col overflow-hidden sm:flex">
            {showDesktopSplitSkeleton ? (
              <DesktopPartiesSplitSkeleton />
            ) : (
              <DesktopEntityTabSplit
                detailsOpen={pane3Open}
                list={
                  <>
                    <DesktopListPaneChrome
                      searchPlaceholder={PARTIES_TAB_SEARCH_PLACEHOLDER}
                      searchValue={searchInput}
                      onSearchChange={setSearchInput}
                      searchAccessory={searchAccessory}
                      chips={PARTIES_TAB_FILTER_CHIPS}
                      chipActiveId={filterId}
                      onChipChange={(id) => {
                        if (isPartiesTabFilterId(id)) setFilterId(id);
                      }}
                      detailsOpen={pane3Open}
                      onToggleDetails={() => setPane3Open((v) => !v)}
                    />
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                      <div
                        ref={desktopListScrollRef}
                        className="relative z-0 min-h-0 flex-1 overflow-y-auto pb-3 pr-4 pt-2"
                      >
                        {listBlock(true)}
                      </div>
                      {addPartyOpen ? (
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

      <FormSidebar
        open={addPartyOpen && Boolean(warehouseId) && !offline && !wide}
        title="Add Party"
        onClose={() => setAddPartyOpen(false)}
      >
        {warehouseId ? (
          <AddPartyForm
            layoutVariant="sidebar"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddPartyOpen(false)}
            onSuccess={(row) => {
              if (row) {
                setLocalData((prev) => mergeUniquePartyRows([row], prev));
                setBaselineRows((prev) => mergeUniquePartyRows([row], prev));
              }
            }}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
