import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { PackageMinus, PackagePlus, SearchX } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
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
  stockTabCacheKey,
  STOCK_TAB_FILTER_CHIPS,
  STOCK_TAB_SEARCH_PLACEHOLDER,
  writeStockTabCache,
  type StockMovementRow,
  type StockTabFilterId,
  type StockTabKpis,
} from "@stockright/shared/stock-tab";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";
import { useIsOffline } from "@/hooks/useIsOffline";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { mobileStockTabCacheAdapter } from "@/lib/stockTabCacheAdapter";

const STROKE = 2;
const MOBILE_PAGE_SIZE = 15;

function formatBags(n: number): string {
  return n.toLocaleString("en-IN");
}

function movementLabel(tx: StockMovementRow["transaction_type"]): string {
  return tx === "lodgement" ? "Inward" : "Outward";
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

export default function StockScreen() {
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
  const stockCacheAdapter = mobileStockTabCacheAdapter;

  const cacheKey = useMemo(
    () => (warehouseId ? stockTabCacheKey(warehouseId) : null),
    [warehouseId]
  );

  const [filterId, setFilterId] = useState<StockTabFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);

  const [localData, setLocalData] = useState<StockMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<StockTabKpis | null>(null);
  const kpisRef = useRef<StockTabKpis | null>(null);
  kpisRef.current = kpis;

  const [initialLoading, setInitialLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"network" | "cache">("network");
  const [loadError, setLoadError] = useState<string | null>(null);

  const localDataRef = useRef<StockMovementRow[]>([]);
  localDataRef.current = localData;
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevMobileFilterRef = useRef<StockTabFilterId | null>(null);

  const endFetchRef = useRef<() => void>(() => {});

  const searchResults = useMemo(
    () => applyStockTabClientFilters(localData, filterId, searchInput),
    [localData, filterId, searchInput]
  );

  useEffect(() => {
    setMobilePage(1);
    setLocalData([]);
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
      const cached = await readStockTabCache(stockCacheAdapter, cacheKey);
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
  }, [warehouseId, offline, cacheKey, stockCacheAdapter]);

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
            void writeStockTabCache(stockCacheAdapter, cacheKey, {
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
          const cached = cacheKey ? await readStockTabCache(stockCacheAdapter, cacheKey) : null;
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
    debouncedSearch,
    filterId,
    mobilePage,
    offline,
    supabase,
    cacheKey,
    stockCacheAdapter,
    searchInput,
  ]);

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
          title="Stock"
          searchPlaceholder={STOCK_TAB_SEARCH_PLACEHOLDER}
          chips={STOCK_TAB_FILTER_CHIPS}
          chipActiveId={filterId}
          onChipChange={(id) => {
            if (isStockTabFilterId(id)) setFilterId(id);
          }}
        />
        <Text style={styles.emptyWarehouse}>Select a warehouse to see stock activity.</Text>
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
        title="Stock"
        searchPlaceholder={STOCK_TAB_SEARCH_PLACEHOLDER}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        chips={STOCK_TAB_FILTER_CHIPS}
        chipActiveId={filterId}
        searchAccessory={searchAccessory}
        onChipChange={(id) => {
          if (isStockTabFilterId(id)) setFilterId(id);
        }}
      />

      <View style={styles.body}>
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
                <Text style={styles.kpiLabel}>ACTIVE STOCK</Text>
                <Text style={[styles.kpiValue, { color: tokens.textPrimary }]}>
                  {kpis ? `${formatBags(kpis.activeStockBags)} bags` : "—"}
                </Text>
                <Text style={styles.kpiSub}>
                  {kpis ? `${formatBags(kpis.activeStockLots)} lots` : ""}
                </Text>
              </View>
              <View style={styles.kpi}>
                <Text style={styles.kpiLabel}>STALE STOCK</Text>
                <Text style={[styles.kpiValue, { color: tokens.pending }]}>
                  {kpis ? `${formatBags(kpis.staleStockBags)} bags` : "—"}
                </Text>
                <Text style={styles.kpiSub}>
                  {kpis ? `${formatBags(kpis.staleStockLots)} lots` : ""}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>Recent activity</Text>

        {offline && localData.length === 0 ? (
          <Text style={styles.empty}>Connect once to load stock activity on this device.</Text>
        ) : showSkeleton ? (
          <ListSkeleton />
        ) : showListEmpty ? (
          <View style={styles.emptyIconWrap}>
            <SearchX size={40} color={tokens.textTertiary} strokeWidth={STROKE} />
            <Text style={styles.empty}>No matches. Try a different search or filter.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {searchResults.map((row: StockMovementRow) => {
              const isLodgement = row.transaction_type === "lodgement";
              return (
                <Pressable
                  key={stockMovementRowKey(row)}
                  style={({ pressed }) => [styles.txn, pressed && styles.txnPressed]}
                >
                  <View
                    style={[
                      styles.txnIcon,
                      {
                        backgroundColor: isLodgement ? tokens.inwardBg : tokens.outwardBg,
                        borderColor: isLodgement ? tokens.inwardBorder : tokens.outwardBorder,
                      },
                    ]}
                  >
                    {isLodgement ? (
                      <PackagePlus size={18} color={tokens.inward} strokeWidth={STROKE} />
                    ) : (
                      <PackageMinus size={18} color={tokens.outward} strokeWidth={STROKE} />
                    )}
                  </View>
                  <View style={styles.txnMid}>
                    <Text style={styles.txnMeta}>
                      {movementLabel(row.transaction_type)} · {row.lot_number} ·{" "}
                      {formatStockActivityDate(row.tx_date)}
                    </Text>
                    <Text style={styles.txnParty} numberOfLines={1}>
                      {row.customer_name}
                    </Text>
                    <Text style={styles.txnProduct} numberOfLines={1}>
                      {row.product_name} · {formatLotStatusLabel(row.lot_status)}
                    </Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={styles.txnAmt}>{formatBags(row.num_bags)}</Text>
                    <Text style={styles.txnType}>Bags</Text>
                  </View>
                </Pressable>
              );
            })}
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
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    minHeight: 48,
    paddingVertical: tokens.sp3,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSurface,
  },
  txnPressed: { opacity: 0.96 },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  txnMid: { flex: 1, minWidth: 0, gap: 2 },
  txnMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
  },
  txnParty: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  txnProduct: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
  },
  txnRight: { alignItems: "flex-end" },
  txnAmt: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    fontVariant: ["tabular-nums"],
    color: tokens.textPrimary,
  },
  txnType: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.textTertiary,
    textTransform: "uppercase",
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