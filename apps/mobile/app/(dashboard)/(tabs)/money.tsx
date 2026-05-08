import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, type ListRenderItem } from "react-native";
import { HandCoins, Wallet } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  MONEY_FILTER_CHIPS,
  calendarMonthRangeLocal,
  countMoneyMovements,
  displayMoneyReference,
  fetchMoneyMonthTotals,
  listMoneyMovements,
  type MoneyMovementRow,
} from "@stockright/shared/api";
import { formatDate, formatIndianCurrency } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { TabScreenHeader } from "@/components/landing/TabScreenHeader";
import { useMoneyAccessContext } from "@/contexts/MoneyAccessContext";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

const STROKE = 2;
const MOBILE_PAGE_SIZE = 15;

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
  const { canManageMoney, loaded: accessLoaded } = useMoneyAccessContext();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chip, setChip] = useState<ChipId>("all");

  const [mobileRows, setMobileRows] = useState<MoneyMovementRow[]>([]);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [mobileListRevision, setMobileListRevision] = useState(0);

  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<{ received: number; paid: number; rCount: number; pCount: number } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const endFetchRef = useRef<() => void>(() => {});

  useFocusEffect(
    useCallback(() => {
      void storage.get("active_warehouse_id").then((id) => {
        setWarehouseId(id && id.length > 0 ? id : null);
      });
    }, [])
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!accessLoaded) return;
    if (!canManageMoney) {
      router.replace("/");
    }
  }, [accessLoaded, canManageMoney, router]);

  useEffect(() => {
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
          pageSize: MOBILE_PAGE_SIZE,
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
  }, [warehouseId, debouncedSearch, chip, mobilePage, mobileListRevision, canManageMoney, supabase]);

  endFetchRef.current = () => {
    if (!warehouseId || mobileLoadingMore) return;
    const loaded = mobileRows.length;
    if (loaded === 0 || totalCount === 0 || loaded >= totalCount) return;
    if (loaded < mobilePage * MOBILE_PAGE_SIZE - 4) return;
    setMobilePage((p) => p + 1);
  };

  const handleEndReached = useCallback(() => {
    endFetchRef.current();
  }, []);

  const renderItem: ListRenderItem<MoneyMovementRow> = useCallback(({ item: t }) => {
    const isReceipt = t.transaction_type === "receipt";
    return (
      <Pressable style={({ pressed }) => [styles.txn, pressed && styles.txnPressed]}>
        <View
          style={[
            styles.txnIcon,
            {
              backgroundColor: isReceipt ? tokens.inwardBg : tokens.outwardBg,
              borderColor: isReceipt ? tokens.inwardBorder : tokens.outwardBorder,
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
          <Text style={styles.txnMeta}>
            {displayMoneyReference(t)} · {formatDate(t.occurred_at)}
          </Text>
          <Text style={styles.txnParty} numberOfLines={1}>
            {t.counterparty_name}
          </Text>
          {isReceipt && t.receipt_allocated === false ? (
            <View style={styles.allocatePill}>
              <Text style={styles.allocatePillText}>Allocate amount</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.txnRight}>
          <Text style={[styles.txnAmt, { color: isReceipt ? tokens.inward : tokens.outward }]}>{formatRowAmount(t)}</Text>
          <Text style={styles.methodLine}>{paymentMethodLabel(t.payment_method)}</Text>
          {!isReceipt && t.payment_type_name ? (
            <Text style={styles.typeLine}>{t.payment_type_name}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }, []);

  const listHeader = useMemo(
    () => (
      <>
        <TabScreenHeader
          title="Money"
          searchPlaceholder="Search by reference, party, method, date…"
          chips={MONEY_FILTER_CHIPS}
          chipActiveId={chip}
          onChipChange={(id) => setChip(id as ChipId)}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
        />
        <View style={styles.body}>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>THIS MONTH RECEIVED</Text>
              <Text style={[styles.kpiValue, { color: tokens.inward }]}>
                {kpis ? formatIndianCurrency(kpis.received) : "—"}
              </Text>
              <Text style={styles.kpiSub}>{kpis ? `${kpis.rCount} receipts recorded` : "Loading totals…"}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>THIS MONTH PAID</Text>
              <Text style={[styles.kpiValue, { color: tokens.outward }]}>
                {kpis ? formatIndianCurrency(kpis.paid) : "—"}
              </Text>
              <Text style={styles.kpiSub}>{kpis ? `${kpis.pCount} payments recorded` : "Loading totals…"}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Recent activity</Text>

          {initialLoading && mobileRows.length === 0 ? <ListSkeleton /> : null}
        </View>
      </>
    ),
    [chip, kpis, mobileRows.length, searchInput, initialLoading]
  );

  if (!accessLoaded || !canManageMoney) {
    return (
      <View style={styles.guardSkeleton}>
        <View style={styles.guardBar} />
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
        />
        <Text style={styles.emptyWarehouse}>Select a warehouse to see money activity.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={initialLoading && mobileRows.length === 0 ? [] : mobileRows}
      keyExtractor={(item) => `${item.transaction_type}-${item.event_id}`}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.listContent}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.35}
      ItemSeparatorComponent={() => <View style={{ height: tokens.sp2 }} />}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: tokens.dashboardScrollBottomInset,
    backgroundColor: tokens.bgPage,
  },
  body: {
    paddingHorizontal: tokens.sp4,
    gap: tokens.sp4,
    paddingTop: tokens.sp4,
    paddingBottom: tokens.sp2,
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
    fontSize: 17,
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
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.sp3,
    paddingVertical: tokens.sp3,
    paddingHorizontal: 14,
    marginHorizontal: tokens.sp4,
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
    letterSpacing: 0.04,
  },
  txnParty: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
  },
  txnRight: { alignItems: "flex-end", flexShrink: 0 },
  txnAmt: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  methodLine: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    color: tokens.textTertiary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  typeLine: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    letterSpacing: 0.06,
    color: tokens.textTertiary,
    marginTop: 2,
    textTransform: "uppercase",
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
    marginHorizontal: tokens.sp4,
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
});
