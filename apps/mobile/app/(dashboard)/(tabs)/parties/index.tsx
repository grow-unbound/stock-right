import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SearchX, User } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
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
import { PARTIES_REFRESH_EVENT } from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { ACTIVE_WAREHOUSE_ID_KEY, formatIndianCurrency } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";
import { useIsOffline } from "@/hooks/useIsOffline";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { mobilePartiesTabCacheAdapter } from "@/lib/partiesTabCacheAdapter";

const STROKE = 2;
const MOBILE_PAGE_SIZE = 15;

function formatBags(n: number): string {
  return n.toLocaleString("en-IN");
}

function partyLotSummaryLine(row: PartiesTabListRow): string {
  const totalLots = row.lots_active + row.lots_stale + row.lots_delivered;
  const lotWord = totalLots === 1 ? "lot" : "lots";
  return `${totalLots} ${lotWord} (${row.lots_active} active, ${row.lots_stale} stale, ${row.lots_delivered} delivered) · ${formatBags(row.bags_active_stale_delivered)} bags`;
}

function ListSkeleton() {
  return (
    <View style={styles.skeletonCol}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

export default function PartiesScreen() {
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseHydrated, setWarehouseHydrated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void storage.get(ACTIVE_WAREHOUSE_ID_KEY).then((id) => {
        if (cancelled) return;
        setWarehouseId(id && id.length > 0 ? id : null);
        setWarehouseHydrated(true);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const offline = useIsOffline();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const partiesCacheAdapter = mobilePartiesTabCacheAdapter;

  const cacheKey = useMemo(
    () => (warehouseId ? partiesTabCacheKey(warehouseId) : null),
    [warehouseId]
  );

  const [filterId, setFilterId] = useState<PartiesTabFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const [localData, setLocalData] = useState<PartiesTabListRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<PartiesTabListRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<PartiesTabKpis | null>(null);
  const kpisRef = useRef<PartiesTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);

  const localDataRef = useRef<PartiesTabListRow[]>([]);
  localDataRef.current = localData;
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevMobileFilterRef = useRef<PartiesTabFilterId | null>(null);

  const endFetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PARTIES_REFRESH_EVENT, (row: PartiesTabListRow) => {
      if (!row?.customer_id) return;
      setLocalData((prev) => mergeUniquePartyRows([row], prev));
      setBaselineRows((prev) => mergeUniquePartyRows([row], prev));
    });
    return () => sub.remove();
  }, []);

  const searchResults = useMemo(
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
    setMobilePage(1);
    setLocalData([]);
    setBaselineRows([]);
    setInitialLoading(true);
    prevMobileSearchRef.current = null;
    prevMobileFilterRef.current = null;
    setLoadError(null);
  }, [warehouseId]);

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
      const cached = await readPartiesTabCache(partiesCacheAdapter, cacheKey);
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
  }, [warehouseId, offline, cacheKey, partiesCacheAdapter]);

  useEffect(() => {
    if (!warehouseId || offline) return;

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
            void writePartiesTabCache(partiesCacheAdapter, cacheKey, {
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
          const cached = cacheKey ? await readPartiesTabCache(partiesCacheAdapter, cacheKey) : null;
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
  }, [warehouseId, debouncedSearch, filterId, mobilePage, offline, supabase, cacheKey, partiesCacheAdapter]);

  endFetchRef.current = () => {
    if (!warehouseId || offline || mobileLoadingMore) return;
    const loaded = localData.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < mobilePage * MOBILE_PAGE_SIZE - 4) return;
    setMobilePage((p) => p + 1);
  };

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const pad = 160;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - pad) {
      endFetchRef.current();
    }
  }, []);

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <ActivityIndicator size="small" color={tokens.brandUi} style={styles.searchSpinner} />
    ) : null;

  const showListEmpty =
    Boolean(warehouseId) &&
    !initialLoading &&
    searchResults.length === 0 &&
    !(offline && localData.length === 0);

  const showSkeleton = initialLoading && localData.length === 0;

  if (!warehouseHydrated) {
    return (
      <View style={[styles.screen, styles.hydrateWrap]}>
        <ListSkeleton />
      </View>
    );
  }

  if (!warehouseId) {
    return (
      <View style={styles.noWarehouseRoot}>
        <TabScreenHeader
          title="Parties"
          searchPlaceholder={PARTIES_TAB_SEARCH_PLACEHOLDER}
          chips={PARTIES_TAB_FILTER_CHIPS}
          chipActiveId={filterId}
          onChipChange={(id) => {
            if (isPartiesTabFilterId(id)) setFilterId(id);
          }}
        />
        <Text style={styles.emptyWarehouse}>Select a warehouse to see parties.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={32}
    >
      <TabScreenHeader
        title="Parties"
        searchPlaceholder={PARTIES_TAB_SEARCH_PLACEHOLDER}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        chips={PARTIES_TAB_FILTER_CHIPS}
        chipActiveId={filterId}
        searchAccessory={searchAccessory}
        onChipChange={(id) => {
          if (isPartiesTabFilterId(id)) setFilterId(id);
        }}
      />

      <View style={styles.body}>
        {offline ? (
          <Text style={styles.offlineHint}>
            You are offline. Showing saved parties from this device.
          </Text>
        ) : null}

        {loadError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {loadError}
            {dataSource === "cache" ? <Text style={styles.muted}> Showing saved data.</Text> : null}
          </Text>
        ) : null}

        <View style={styles.kpiRow}>
          {showSkeleton ? (
            <>
              <View style={[styles.kpi, styles.skeleton]} />
              <View style={[styles.kpi, styles.skeleton]} />
            </>
          ) : (
            <>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Total Outstanding</Text>
                <Text style={[styles.kpiValue, { color: tokens.pending }]}>
                  {kpis ? formatIndianCurrency(kpis.totalOutstanding) : "—"}
                </Text>
                <Text style={styles.kpiSub}>
                  {kpis ? `${formatBags(kpis.customersWithOutstanding)} customers` : "Loading…"}
                </Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>Stale Stock</Text>
                <Text style={[styles.kpiValue, { color: tokens.textPrimary }]}>
                  {kpis ? `${formatBags(kpis.staleStockBags)} bags` : "—"}
                </Text>
                <Text style={styles.kpiSub}>
                  {kpis ? `${formatBags(kpis.partiesWithStale)} parties` : "Loading…"}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>Maximum outstanding</Text>

        {offline && localData.length === 0 ? (
          <Text style={styles.empty}>Connect once to load parties on this device.</Text>
        ) : showSkeleton ? (
          <ListSkeleton />
        ) : showListEmpty ? (
          <View style={styles.emptyIconWrap}>
            <SearchX size={40} color={tokens.textTertiary} strokeWidth={STROKE} />
            <Text style={styles.empty}>No matches. Try a different search or filter.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {searchResults.map((row) => (
              <Pressable
                key={partyRowKey(row)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowIcon}>
                  <User size={18} color={tokens.brandText} strokeWidth={STROKE} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rowCode} numberOfLines={1}>
                    {row.customer_code}
                  </Text>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.customer_name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {partyLotSummaryLine(row)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmt}>{formatIndianCurrency(row.outstanding_total)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {mobileLoadingMore ? <View style={styles.loadingMoreSkeleton} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { paddingBottom: tokens.dashboardScrollBottomInset },
  searchSpinner: { marginLeft: tokens.sp2 },
  body: {
    paddingHorizontal: tokens.sp4,
    gap: tokens.sp4,
    paddingTop: tokens.sp4,
  },
  offlineHint: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textSecondary,
  },
  hydrateWrap: {
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp4,
  },
  noWarehouseRoot: {
    flex: 1,
    backgroundColor: tokens.bgPage,
    paddingBottom: tokens.dashboardScrollBottomInset,
  },
  emptyWarehouse: {
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp3,
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textSecondary,
  },
  muted: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: tokens.textSecondary,
  },
  errorText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: tokens.outward,
  },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
    padding: tokens.sp3,
    gap: 4,
  },
  kpiLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.textTertiary,
  },
  kpiValue: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  kpiSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textSecondary,
  },
  sectionLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.08,
    color: tokens.textTertiary,
    textTransform: "uppercase",
  },
  list: { gap: tokens.sp2 },
  empty: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: tokens.textSecondary,
    textAlign: "center",
    paddingVertical: tokens.sp4,
  },
  emptyIconWrap: {
    alignItems: "center",
    gap: tokens.sp3,
    paddingVertical: tokens.sp4,
    paddingHorizontal: tokens.sp6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    minHeight: 48,
    paddingVertical: tokens.sp3,
    paddingHorizontal: tokens.sp3,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
  },
  rowPressed: { opacity: 0.96 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.brandSubtle,
  },
  rowMid: { flex: 1, minWidth: 0, gap: 2 },
  rowCode: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
  },
  rowName: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  rowMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
  },
  rowRight: { alignItems: "flex-end" },
  rowAmt: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    color: tokens.pending,
    lineHeight: 18,
  },
  skeleton: {
    minHeight: 88,
    backgroundColor: tokens.bgSubtle,
  },
  skeletonCol: { gap: tokens.sp2 },
  skeletonRow: {
    height: 76,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
  loadingMoreSkeleton: {
    marginTop: tokens.sp2,
    height: 76,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
});
