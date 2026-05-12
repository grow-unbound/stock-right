import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import { HandCoins, SearchX, Wallet } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  MONEY_FILTER_CHIPS,
  calendarMonthRangeLocal,
  countMoneyMovements,
  fetchMoneyMonthTotals,
  listMoneyMovements,
  type MoneyMovementRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { shouldPrefetchListScroll } from "@stockright/shared/list-scroll-prefetch";
import {
  displayMoneyPartyPrimary,
  displayMoneyPartySecondary,
  filterMoneyRowsLocal,
  mergeUniqueMoneyRows,
} from "@stockright/shared/money";
import {
  loadMoneyListSnapshot,
  loadMoneyPendingRows,
  saveMoneyListSnapshot,
} from "@stockright/shared/offline/app-cache";
import { formatIndianCurrency, formatMoneyListDate, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";
import { useMoneyAccessContext } from "@/contexts/MoneyAccessContext";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { mobileMoneyAppCacheAdapter } from "@/lib/money-app-cache";
import { useIsOffline } from "@/hooks/useIsOffline";

const STROKE = 2;
const MOBILE_PAGE_SIZE = 15;
const MONEY_FEED_REFRESH_EVENT = "sr-money-refresh";

type ChipId = "all" | "receipt" | "payment";

function chipToTransactionType(chip: ChipId): "all" | "receipt" | "payment" {
  return chip;
}

function paymentMethodLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

export default function MoneyScreen() {
  const router = useRouter();
  const offline = useIsOffline();
  const { canManageMoney, loaded: accessLoaded } = useMoneyAccessContext();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const moneyCache = mobileMoneyAppCacheAdapter;

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseHydrated, setWarehouseHydrated] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const [chip, setChip] = useState<ChipId>("all");

  const [localData, setLocalData] = useState<MoneyMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const mobileLoadingMoreRef = useRef(false);
  mobileLoadingMoreRef.current = mobileLoadingMore;
  const [remoteSearchPending, setRemoteSearchPending] = useState(false);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<{ received: number; paid: number; rCount: number; pCount: number } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [moneyFeedNonce, setMoneyFeedNonce] = useState(0);

  const localDataRef = useRef<MoneyMovementRow[]>([]);
  localDataRef.current = localData;
  const prevMobileSearchRef = useRef<string | null>(null);
  const prevMobileChipRef = useRef<ChipId | null>(null);

  const endFetchRef = useRef<() => void>(() => {});

  const searchResults = useMemo(
    () => filterMoneyRowsLocal(localData, searchInput, chip),
    [localData, searchInput, chip]
  );

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

  useEffect(() => {
    setMobilePage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevMobileSearchRef.current = null;
    prevMobileChipRef.current = null;
  }, [warehouseId]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MONEY_FEED_REFRESH_EVENT, () => {
      setMoneyFeedNonce((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (moneyFeedNonce === 0) return;
    setMobilePage(1);
    setLocalData([]);
    setInitialLoading(true);
    prevMobileSearchRef.current = null;
    prevMobileChipRef.current = null;
  }, [moneyFeedNonce]);

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
  }, [warehouseId, chip, offline, canManageMoney, moneyCache, moneyFeedNonce]);

  useEffect(() => {
    if (!warehouseId || !canManageMoney || offline) return;

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
          pageSize: MOBILE_PAGE_SIZE,
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
    canManageMoney,
    offline,
    supabase,
    moneyCache,
    moneyFeedNonce,
  ]);

  endFetchRef.current = () => {
    if (!warehouseId || offline || mobileLoadingMore) return;
    const loaded = localData.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < mobilePage * MOBILE_PAGE_SIZE - 4) return;
    setMobilePage((p) => p + 1);
  };

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const loaded = localDataRef.current.length;
      if (
        shouldPrefetchListScroll(contentOffset.y, layoutMeasurement.height, contentSize.height, {
          hasMore: loaded > 0 && totalCount > 0 && loaded < totalCount,
          loading: mobileLoadingMoreRef.current,
        })
      ) {
        endFetchRef.current();
      }
    },
    [totalCount]
  );

  const searchAccessory =
    searchInput.trim() !== "" && (remoteSearchPending || searchInput.trim() !== debouncedSearch) ? (
      <ActivityIndicator size="small" color={tokens.brandUi} style={styles.searchSpinner} />
    ) : null;

  const listBody = useMemo(() => {
    if (!warehouseId) return null;
    if (initialLoading && localData.length === 0) {
      return <ListSkeleton />;
    }
    if (!offline && !initialLoading && searchResults.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <SearchX size={40} color={tokens.textTertiary} strokeWidth={2} />
          <Text style={styles.emptyText}>No matches. Try a different search or filter.</Text>
        </View>
      );
    }
    return (
      <View style={styles.listBlock}>
        {searchResults.map((t) => {
          const isReceipt = t.transaction_type === "receipt";
          const secondary = displayMoneyPartySecondary(t);
          return (
            <Pressable
              key={`${t.transaction_type}-${t.event_id}`}
              style={({ pressed }) => [styles.txn, pressed && styles.txnPressed]}
            >
              <View
                style={[
                  styles.txnIcon,
                  {
                    backgroundColor: isReceipt ? tokens.inwardBg : tokens.outwardBg,
                  },
                ]}
              >
                {isReceipt ? (
                  <HandCoins size={18} color={tokens.inward} strokeWidth={STROKE} />
                ) : (
                  <Wallet size={18} color={tokens.outward} strokeWidth={STROKE} />
                )}
              </View>
              <View style={styles.txnMid}>
                <Text style={styles.txnMeta}>{formatMoneyListDate(t.occurred_at)}</Text>
                <Text style={styles.txnParty} numberOfLines={2}>
                  {displayMoneyPartyPrimary(t)}
                </Text>
                {secondary ? (
                  <Text style={styles.txnSecondary} numberOfLines={2}>
                    {secondary}
                  </Text>
                ) : null}
                {isReceipt && t.receipt_allocated === false ? (
                  <View style={styles.allocatePill}>
                    <Text style={styles.allocatePillText}>Needs allocation</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.txnRight}>
                <Text style={[styles.txnAmt, { color: isReceipt ? tokens.inward : tokens.outward }]}>
                  {formatIndianCurrency(t.amount)}
                </Text>
                <Text style={styles.methodLine}>{paymentMethodLabel(t.payment_method)}</Text>
              </View>
            </Pressable>
          );
        })}
        {mobileLoadingMore ? (
          <View style={styles.footerLoading}>
            <View style={styles.footerSkeleton} />
          </View>
        ) : null}
      </View>
    );
  }, [
    warehouseId,
    initialLoading,
    localData.length,
    offline,
    searchResults,
    mobileLoadingMore,
  ]);

  if (!accessLoaded || !canManageMoney) {
    return (
      <View style={styles.guardSkeleton}>
        <View style={styles.guardBar} />
      </View>
    );
  }

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
          title="Money"
          searchPlaceholder="Search by reference, party, method, date…"
          chips={MONEY_FILTER_CHIPS}
          chipActiveId={chip}
          onChipChange={(id) => setChip(id as ChipId)}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchAccessory={searchAccessory}
        />
        <Text style={styles.emptyWarehouse}>Select a warehouse to see money activity.</Text>
      </View>
    );
  }

  if (offline && localData.length === 0 && !initialLoading) {
    return (
      <View style={styles.noWarehouseRoot}>
        <TabScreenHeader
          title="Money"
          searchPlaceholder="Search by reference, party, method, date…"
          chips={MONEY_FILTER_CHIPS}
          chipActiveId={chip}
          onChipChange={(id) => setChip(id as ChipId)}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchAccessory={searchAccessory}
        />
        <View style={styles.body}>
          <Text style={styles.offlineConnect}>Connect once to load money activity on this device.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={400}
    >
      <TabScreenHeader
        title="Money"
        searchPlaceholder="Search by reference, party, method, date…"
        chips={MONEY_FILTER_CHIPS}
        chipActiveId={chip}
        onChipChange={(id) => setChip(id as ChipId)}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchAccessory={searchAccessory}
      />
      <View style={styles.body}>
        {offline ? (
          <Text style={styles.offlineHint}>You’re offline. Showing saved activity from this device.</Text>
        ) : null}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>THIS MONTH RECEIVED</Text>
            <Text style={[styles.kpiValue, { color: tokens.inward }]}>{kpis ? formatIndianCurrency(kpis.received) : "—"}</Text>
            <Text style={styles.kpiSub}>{kpis ? `${kpis.rCount} receipts recorded` : "Loading totals…"}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>THIS MONTH PAID</Text>
            <Text style={[styles.kpiValue, { color: tokens.outward }]}>{kpis ? formatIndianCurrency(kpis.paid) : "—"}</Text>
            <Text style={styles.kpiSub}>{kpis ? `${kpis.pCount} payments recorded` : "Loading totals…"}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Recent activity</Text>

        {listBody}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  scrollContent: {
    paddingBottom: tokens.dashboardScrollBottomInset,
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: tokens.sp4,
    gap: tokens.sp4,
    paddingTop: tokens.sp4,
    paddingBottom: tokens.sp2,
  },
  offlineHint: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    color: tokens.textSecondary,
  },
  offlineConnect: {
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textSecondary,
    paddingHorizontal: tokens.sp4,
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
  searchSpinner: { marginRight: 4 },
  listBlock: { gap: tokens.sp2 },
  txn: {
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
  txnPressed: { opacity: 0.96 },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    alignItems: "center",
    justifyContent: "center",
  },
  txnMid: { flex: 1, minWidth: 0, gap: 2 },
  txnMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
  },
  txnParty: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  txnSecondary: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    textAlign: "left",
  },
  txnRight: { alignItems: "flex-end", flexShrink: 0 },
  txnAmt: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  methodLine: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    color: tokens.textSecondary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  allocatePill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.pendingBorder,
    backgroundColor: tokens.pendingBg,
  },
  allocatePillText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.pending,
    textTransform: "uppercase",
  },
  skeletonWrap: { gap: tokens.sp2 },
  skeletonRow: {
    height: 72,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
  emptyWarehouse: {
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp3,
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textSecondary,
  },
  emptyWrap: {
    alignItems: "center",
    gap: tokens.sp3,
    paddingVertical: tokens.sp8,
    paddingHorizontal: tokens.sp4,
  },
  emptyText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textSecondary,
    textAlign: "center",
  },
  footerLoading: {
    paddingVertical: tokens.sp4,
    alignItems: "center",
  },
  footerSkeleton: {
    height: 48,
    width: "88%",
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
  noWarehouseRoot: {
    flex: 1,
    backgroundColor: tokens.bgPage,
    paddingBottom: tokens.dashboardScrollBottomInset,
  },
  guardSkeleton: {
    flex: 1,
    backgroundColor: tokens.bgPage,
    padding: tokens.sp4,
  },
  guardBar: {
    height: 200,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
  hydrateWrap: {
    paddingHorizontal: tokens.sp4,
    paddingTop: tokens.sp4,
  },
});
