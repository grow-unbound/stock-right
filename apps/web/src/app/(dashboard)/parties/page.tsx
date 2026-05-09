"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { PARTIES_REFRESH_EVENT } from "@stockright/shared/api";
import { formatIndianCurrency } from "@stockright/shared/utils";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { AddPartyForm } from "@/components/parties/add-party/AddPartyForm";
import { PartiesActivityTable } from "@/components/parties/PartiesActivityTable";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { webPartiesTabCacheAdapter } from "@/lib/parties-app-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STROKE = 2;
const MOBILE_PAGE_SIZE = 15;

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
  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopPageSize, setDesktopPageSize] = useState(20);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);

  const [localData, setLocalData] = useState<PartiesTabListRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<PartiesTabListRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<PartiesTabKpis | null>(null);
  const kpisRef = useRef<PartiesTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addPartyOpen, setAddPartyOpen] = useState(false);

  const localDataRef = useRef<PartiesTabListRow[]>([]);
  localDataRef.current = localData;
  const prevDesktopSearchRef = useRef<string | null>(null);
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevDesktopFilterRef = useRef<PartiesTabFilterId | null>(null);
  const prevMobileFilterRef = useRef<PartiesTabFilterId | null>(null);

  const mobileNearEndRef = useRef<() => void>(() => {});
  const sentinelRef = useRef<HTMLDivElement>(null);

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
    }
    window.addEventListener(PARTIES_REFRESH_EVENT, onPartiesRefresh);
    return () => window.removeEventListener(PARTIES_REFRESH_EVENT, onPartiesRefresh);
  }, []);

  const desktopTableRows = useMemo(
    () => applyPartiesTabClientFilters(localData, filterId, searchInput),
    [localData, filterId, searchInput]
  );

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
    setDesktopPage(1);
    setMobilePage(1);
    setLocalData([]);
    setBaselineRows([]);
    setInitialLoading(true);
    prevDesktopSearchRef.current = null;
    prevMobileSearchRef.current = null;
    prevDesktopFilterRef.current = null;
    prevMobileFilterRef.current = null;
    setLoadError(null);
  }, [warehouseId]);

  useEffect(() => {
    setDesktopPage(1);
    setMobilePage(1);
    setLocalData([]);
    setBaselineRows([]);
    prevDesktopSearchRef.current = null;
    prevMobileSearchRef.current = null;
    prevDesktopFilterRef.current = null;
    prevMobileFilterRef.current = null;
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
    if (debouncedSearch !== "") setRemoteSearchPending(true);
    setLoadError(null);

    void (async () => {
      try {
        const [count, rows] = await Promise.all([
          countPartiesTab(supabase, {
            warehouseId,
            search,
            filterId,
          }),
          listPartiesTab(supabase, {
            warehouseId,
            search,
            filterId,
            page: desktopPageToFetch,
            pageSize: desktopPageSize,
          }),
        ]);
        if (cancelled) return;
        setTotalCount(count);
        setLocalData(rows);

        const k = kpisRef.current;
        if (cacheKey && desktopPageToFetch === 1 && search === "") {
          void writePartiesTabCache(webPartiesTabCacheAdapter, cacheKey, {
            baselineRows: rows,
            kpis: k ?? null,
          });
        }
        if (filterId === "all" && search === "" && desktopPageToFetch === 1) {
          setBaselineRows(rows);
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
          setDesktopLoading(false);
          setRemoteSearchPending(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, offline, wide, filterId, debouncedSearch, desktopPage, desktopPageSize, supabase, cacheKey]);

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
    if (debouncedSearch !== "") setRemoteSearchPending(true);
    if (mobilePageToFetch === 1 && localDataRef.current.length === 0) {
      setInitialLoading(true);
    }
    setLoadError(null);

    void (async () => {
      try {
        if (mobilePageToFetch === 1) {
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
          page: mobilePageToFetch,
          pageSize: MOBILE_PAGE_SIZE,
        });

        if (cancelled) return;

        const k = kpisRef.current;

        setLocalData((prev) => {
          const next = mobilePageToFetch === 1 ? rows : mergeUniquePartyRows(prev, rows);
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
            mobilePageToFetch === 1 ? mergeUniquePartyRows([], rows) : mergeUniquePartyRows(prev, rows)
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
          setMobileLoadingMore(false);
          setRemoteSearchPending(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, offline, wide, debouncedSearch, filterId, mobilePage, supabase, cacheKey]);

  mobileNearEndRef.current = () => {
    if (!warehouseId || offline || wide || mobileLoadingMore) return;
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

  const addParty = DEMO_FAB_PARTIES_ACTIONS[0];

  const desktopActions = addParty ? (
    <Button
      variant="primary"
      size="sm"
      type="button"
      className="min-w-[var(--cta-tab-min-width)] justify-center"
      onClick={() => {
        if (wide) {
          setAddPartyOpen(true);
        } else {
          router.push("/parties/new");
        }
      }}
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
    !desktopLoading &&
    !initialLoading &&
    (wide ? desktopTableRows.length === 0 : mobileSearchResults.length === 0) &&
    !(offline && localData.length === 0);

  const showDesktopSkeleton =
    wide && !!warehouseId && !offline && (desktopLoading || (initialLoading && localData.length === 0));

  const showMobileSkeleton =
    !wide && !!warehouseId && !offline && initialLoading && localData.length === 0;

  return (
    <DashboardPageShell
      title="Parties"
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
        if (wide) {
          setAddPartyOpen(true);
        } else {
          router.push("/parties/new");
        }
      }}
    >
      <div className="flex flex-col gap-4 px-0 pt-4">
        {!warehouseId ? (
          <p className="text-[15px] text-[var(--text-secondary)]">Select a warehouse to see parties.</p>
        ) : null}

        {warehouseId && offline ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            You are offline. Showing saved parties from this device.
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
            {showDesktopSkeleton || showMobileSkeleton ? (
              <>
                <div className="h-[88px] skeleton rounded-[var(--radius-md)]" />
                <div className="h-[88px] skeleton rounded-[var(--radius-md)]" />
              </>
            ) : (
              <>
                <DashboardKpiCard
                  label="Total outstanding"
                  value={kpis ? formatIndianCurrency(kpis.totalOutstanding) : "—"}
                  sub={kpis ? `${formatBags(kpis.customersWithOutstanding)} customers` : "Loading…"}
                  accentClass="text-[var(--pending)]"
                />
                <DashboardKpiCard
                  label="Stale stock"
                  value={kpis ? `${formatBags(kpis.staleStockBags)} bags` : "—"}
                  sub={kpis ? `${formatBags(kpis.partiesWithStale)} customers` : "Loading…"}
                  accentClass="text-[var(--text-primary)]"
                />
              </>
            )}
          </div>
        ) : null}

        {warehouseId ? (
          <>
            <DashboardSectionHeader label="Maximum outstanding" />

            <div className="hidden sm:block">
              {offline && localData.length === 0 ? (
                <p className="text-[15px] text-[var(--text-secondary)]">
                  Connect once to load parties on this device.
                </p>
              ) : showDesktopSkeleton ? (
                <PartyListSkeleton />
              ) : showListEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : (
                <PartiesActivityTable
                  rows={desktopTableRows}
                  totalCount={totalCount}
                  page={desktopPage}
                  pageSize={desktopPageSize}
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
                  Connect once to load parties on this device.
                </p>
              ) : showMobileSkeleton ? (
                <PartyListSkeleton />
              ) : showListEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mobileSearchResults.map((row) => (
                    <li key={partyRowKey(row)}>
                      <RegisterListRow
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
                  ))}
                </ul>
              )}
              {mobileLoadingMore ? (
                <div className="mt-2 h-[72px] skeleton rounded-[var(--radius-md)]" />
              ) : null}
              <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
            </div>
          </>
        ) : null}
      </div>

      <FormSidebar
        open={addPartyOpen && Boolean(warehouseId) && !offline}
        title="Add Party"
        onClose={() => setAddPartyOpen(false)}
      >
        {warehouseId ? (
          <AddPartyForm
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => setAddPartyOpen(false)}
            onSuccess={() => {}}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
