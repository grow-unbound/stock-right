import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createReceiptWithAllocations,
  fetchCustomerOutstandingTotals,
  fetchOutstandingAllocatable,
  searchCustomersQuickPick,
  suggestNextReceiptReference,
  type OutstandingAllocatableRow,
  type PartiesTabRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import {
  buildFifoAllocations,
  formatRupeeDigitsForInput,
  formatRupeeInputLive,
  isPartialAllocation,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { formatIndianCurrency, partyInitials, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

const PAGE_SIZE = 25;
const MONEY_FEED_REFRESH_EVENT = "sr-money-refresh";
const STROKE = 2;
const winW = Dimensions.get("window").width;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface DraftRow {
  lineKind: "rent" | "charge";
  lineId: string;
  remainingAmount: number;
  allocated: number;
  enabled: boolean;
  source: OutstandingAllocatableRow;
}

function buildDraft(rows: OutstandingAllocatableRow[], receiptAmount: number): DraftRow[] {
  const sources = rows.map((r) => ({
    lineKind: r.line_kind,
    lineId: r.line_id,
    remainingAmount: r.remaining_amount,
  }));
  const fifo = buildFifoAllocations(sources, receiptAmount);
  const map = new Map(fifo.map((f) => [`${f.lineKind}:${f.lineId}`, f.amount]));
  return rows.map((r) => {
    const amt = map.get(`${r.line_kind}:${r.line_id}`) ?? 0;
    return {
      lineKind: r.line_kind,
      lineId: r.line_id,
      remainingAmount: r.remaining_amount,
      allocated: amt,
      enabled: amt > 0,
      source: r,
    };
  });
}

interface MobileAddReceiptScreenProps {
  warehouseId?: string;
  onClose: () => void;
  onDone: () => void;
}

function mergeById(a: PartiesTabRow[], b: PartiesTabRow[]): PartiesTabRow[] {
  const seen = new Set(a.map((r) => r.customer_id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.customer_id)) {
      seen.add(row.customer_id);
      out.push(row);
    }
  }
  return out;
}

export function MobileAddReceiptScreen({ warehouseId: warehouseIdProp, onClose, onDone }: MobileAddReceiptScreenProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const insets = useSafeAreaInsets();
  const [warehouseId, setWarehouseId] = useState<string | null>(warehouseIdProp ?? null);
  const slideX = useRef(new Animated.Value(winW)).current;

  useEffect(() => {
    if (warehouseIdProp) return;
    let cancelled = false;
    void storage.get(ACTIVE_WAREHOUSE_ID_KEY).then((id) => {
      if (cancelled) return;
      setWarehouseId(id && id.length > 0 ? id : null);
    });
    return () => {
      cancelled = true;
    };
  }, [warehouseIdProp]);

  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const debouncedPicker = useDebouncedValue(pickerQuery.trim(), 320);
  const [pickerRows, setPickerRows] = useState<PartiesTabRow[]>([]);
  const [pickerTotal, setPickerTotal] = useState<number | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const emptyPickCache = useRef<PartiesTabRow[] | null>(null);

  const fetchPickerPage = useCallback(
    async (offset: number, reset: boolean) => {
      if (!warehouseId) return;
      setPickerLoading(true);
      try {
        const { rows, count } = await searchCustomersQuickPick(supabase, {
          warehouseId,
          q: debouncedPicker,
          limit: PAGE_SIZE,
          offset,
        });
        if (count !== null) setPickerTotal(count);
        setPickerRows((prev) => (reset ? rows : mergeById(prev, rows)));
        if (reset && debouncedPicker === "" && rows.length > 0) {
          emptyPickCache.current = rows;
        }
      } finally {
        setPickerLoading(false);
      }
    },
    [debouncedPicker, supabase, warehouseId]
  );

  useEffect(() => {
    if (!pickerOpen) return;
    if (debouncedPicker === "" && emptyPickCache.current && emptyPickCache.current.length > 0) {
      setPickerRows(emptyPickCache.current);
    } else {
      setPickerRows([]);
    }
    setPickerTotal(null);
    void fetchPickerPage(0, true);
  }, [pickerOpen, debouncedPicker, fetchPickerPage]);

  useEffect(() => {
    if (!pickerOpen) {
      Animated.timing(slideX, { toValue: winW, duration: 0, useNativeDriver: true }).start();
      return;
    }
    slideX.setValue(winW);
    Animated.timing(slideX, { toValue: 0, duration: 240, useNativeDriver: true }).start();
  }, [pickerOpen, slideX]);

  const loadMorePicker = useCallback(() => {
    if (pickerLoading) return;
    if (pickerTotal !== null && pickerRows.length >= pickerTotal) return;
    void fetchPickerPage(pickerRows.length, false);
  }, [pickerLoading, pickerTotal, pickerRows.length, fetchPickerPage]);

  const [amountStr, setAmountStr] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [reference, setReference] = useState("");
  const referenceManualRef = useRef(false);
  const [notes, setNotes] = useState("");
  const [allocOpen, setAllocOpen] = useState(false);
  const [outstanding, setOutstanding] = useState<OutstandingAllocatableRow[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ charges: number; rents: number } | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    void suggestNextReceiptReference(supabase, warehouseId).then((s) => {
      if (cancelled || referenceManualRef.current) return;
      setReference(s);
    });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, supabase]);

  useEffect(() => {
    if (!allocOpen || !customer?.customer_id || !warehouseId) {
      setOutstanding([]);
      setTotals(null);
      setOutstandingError(null);
      setDraft([]);
      setLoadingLines(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingLines(true);
      setOutstandingError(null);
      try {
        const [t, lines] = await Promise.all([
          fetchCustomerOutstandingTotals(supabase, warehouseId, customer.customer_id),
          fetchOutstandingAllocatable(supabase, warehouseId, customer.customer_id),
        ]);
        if (cancelled) return;
        setTotals(t ? { charges: t.outstanding_charges, rents: t.outstanding_rents } : { charges: 0, rents: 0 });
        setOutstanding(lines);
      } catch {
        if (!cancelled) {
          setTotals(null);
          setOutstanding([]);
          setOutstandingError("Could not load outstanding details. You can still save the receipt.");
        }
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allocOpen, customer, warehouseId, supabase]);

  useEffect(() => {
    const amt = parseIndianRupeeInput(amountStr);
    if (!amt || amt <= 0 || outstanding.length === 0) {
      setDraft([]);
      return;
    }
    setDraft(buildDraft(outstanding, amt));
  }, [outstanding, amountStr]);

  const dirty =
    customer !== null ||
    amountStr.trim() !== "" ||
    receiptDate !== todayIso() ||
    paymentMethod !== "UPI" ||
    reference.trim() !== "" ||
    notes.trim() !== "" ||
    allocOpen;

  function requestClose() {
    if (dirty) {
      Alert.alert("Discard changes?", "You have unsaved entries.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  }

  async function submit() {
    if (!warehouseId || !customer) {
      Alert.alert("Choose a party");
      return;
    }
    const amt = parseIndianRupeeInput(amountStr);
    if (amt === null || amt <= 0) {
      Alert.alert("Enter a valid amount");
      return;
    }

    const lines =
      allocOpen && draft.length > 0
        ? draft
            .filter((d) => d.enabled && d.allocated > 0)
            .map((d) =>
              d.lineKind === "rent"
                ? { rent_accrual_id: d.lineId, amount: d.allocated }
                : { charge_id: d.lineId, amount: d.allocated }
            )
        : [];

    const sumAlloc = lines.reduce((s, l) => s + l.amount, 0);
    if (sumAlloc > amt + 0.01) {
      Alert.alert("Allocated amounts cannot exceed the receipt total.");
      return;
    }

    setSubmitting(true);
    try {
      await createReceiptWithAllocations(supabase, {
        warehouseId,
        customerId: customer.customer_id,
        receiptDate,
        totalAmount: amt,
        paymentMethod,
        referenceNumber: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
        allocationLines: lines,
      });
      DeviceEventEmitter.emit(MONEY_FEED_REFRESH_EVENT);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Receipt recorded", undefined, [{ text: "OK", onPress: onDone }]);
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = e instanceof Error ? e.message : "Could not save receipt.";
      Alert.alert("Could not save", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!warehouseId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Select a warehouse from Preferences first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => requestClose()}
          style={styles.iconBtn}
        >
          <ArrowLeft size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add Receipt
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Party</Text>
        <Pressable style={styles.fieldBtn} onPress={() => setPickerOpen(true)}>
          <Text style={customer ? styles.fieldText : styles.placeholder}>
            {customer ? `${customer.customer_name} (${customer.customer_code})` : "Search parties…"}
          </Text>
          <ChevronDown size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
        </Pressable>

        <Text style={styles.label}>Amount</Text>
        <View style={styles.rupeeRow}>
          <Text style={styles.rupeeSym}>₹</Text>
          <TextInput
            value={amountStr}
            onChangeText={(t) => setAmountStr(formatRupeeInputLive(t))}
            onBlur={() => {
              const n = parseIndianRupeeInput(amountStr);
              if (n !== null) setAmountStr(formatRupeeDigitsForInput(n));
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={tokens.textPlaceholder}
            style={styles.rupeeInput}
          />
        </View>

        <Text style={styles.label}>Date received</Text>
        <TextInput
          value={receiptDate}
          onChangeText={setReceiptDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tokens.textPlaceholder}
          style={styles.input}
        />

        <Text style={styles.label}>Payment method</Text>
        <View style={styles.pmWrap}>
          {PAYMENT_METHOD_VALUES.map((m) => (
            <Pressable
              key={m}
              style={[styles.pmChip, paymentMethod === m && styles.pmChipOn]}
              onPress={() => setPaymentMethod(m)}
            >
              <Text style={[styles.pmChipText, paymentMethod === m && styles.pmChipTextOn]}>{paymentMethodLabel(m)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Reference (optional)</Text>
        <TextInput
          value={reference}
          onChangeText={(t) => {
            referenceManualRef.current = true;
            setReference(t);
          }}
          style={styles.input}
          placeholder="Reference number"
          placeholderTextColor={tokens.textPlaceholder}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notes]}
          placeholder="Anything your team should remember"
          placeholderTextColor={tokens.textPlaceholder}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.allocSectionTop}>
          <Pressable style={styles.allocToggle} onPress={() => setAllocOpen((v) => !v)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.allocSectionKicker}>Receipt allocations</Text>
              <Text style={styles.allocToggleTitle}>
                Apply to charges & rent <Text style={styles.allocOptional}>(optional)</Text>
              </Text>
            </View>
            {allocOpen ?
              <ChevronUp size={20} color={tokens.textTertiary} strokeWidth={STROKE} />
            : <ChevronDown size={20} color={tokens.textTertiary} strokeWidth={STROKE} />}
          </Pressable>

          {allocOpen ?
            <View style={styles.allocBody}>
              {!customer ?
                <Text style={styles.muted}>Choose a party first.</Text>
              : outstandingError ?
                <Text style={styles.errText}>{outstandingError}</Text>
              : loadingLines ?
                <ActivityIndicator color={tokens.brandUi} />
              : outstanding.length === 0 ?
                <Text style={styles.muted}>
                  No unpaid charges or rents on file for this party. This receipt will be recorded as advance credit.
                </Text>
              : <>
                  {totals ?
                    <View style={styles.totalsRow}>
                      <View style={styles.totalCard}>
                        <Text style={styles.totalLbl}>Charges due</Text>
                        <Text style={styles.totalVal}>{formatIndianCurrency(totals.charges)}</Text>
                      </View>
                      <View style={styles.totalCard}>
                        <Text style={styles.totalLbl}>Rents due</Text>
                        <Text style={styles.totalVal}>{formatIndianCurrency(totals.rents)}</Text>
                      </View>
                    </View>
                  : null}
                  {draft.map((row) => {
                    const partial =
                      row.enabled &&
                      row.allocated > 0 &&
                      isPartialAllocation(row.allocated, row.remainingAmount);
                    const typeLabel = row.lineKind === "rent" ? "Rent" : row.source.line_label;
                    return (
                      <View key={`${row.lineKind}-${row.lineId}`} style={styles.allocRow}>
                        <View style={styles.allocRowTop}>
                          <Switch
                            value={row.enabled}
                            onValueChange={(on) => {
                              setDraft((prev) =>
                                prev.map((r) =>
                                  r.lineId === row.lineId && r.lineKind === row.lineKind ?
                                    { ...r, enabled: on, allocated: on ? r.allocated : 0 }
                                  : r
                                )
                              );
                            }}
                            trackColor={{ false: tokens.bgInset, true: tokens.brandSubtle }}
                            thumbColor={tokens.bgSurface}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.allocMeta}>
                              Lot {row.source.lot_number} · {row.source.product_name}
                            </Text>
                            <Text style={styles.allocTitle}>
                              {typeLabel} · {row.source.balance_bags}/{row.source.original_bags} bags left
                            </Text>
                            <Text style={styles.allocDue}>Due {formatIndianCurrency(row.remainingAmount)}</Text>
                            {partial ?
                              <Text style={styles.partialBadge}>PARTIAL ALLOCATION</Text>
                            : null}
                          </View>
                        </View>
                        <TextInput
                          keyboardType="decimal-pad"
                          editable={row.enabled}
                          value={row.enabled ? formatRupeeDigitsForInput(row.allocated) : "0"}
                          onChangeText={(raw) => {
                            const n = parseIndianRupeeInput(raw);
                            setDraft((prev) =>
                              prev.map((r) =>
                                r.lineId === row.lineId && r.lineKind === row.lineKind ?
                                  {
                                    ...r,
                                    allocated: n === null ? 0 : Math.min(n, r.remainingAmount),
                                    enabled: (n ?? 0) > 0,
                                  }
                                : r
                              )
                            );
                          }}
                          style={styles.allocAmt}
                        />
                      </View>
                    );
                  })}
                </>
              }
            </View>
          : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.cancelBtn} onPress={requestClose} disabled={submitting}>
          <X size={18} color={tokens.textPrimary} strokeWidth={STROKE} />
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.submitBtn} onPress={() => void submit()} disabled={submitting}>
          <Check size={18} color={tokens.textOnBrand} strokeWidth={STROKE} />
          <Text style={styles.submitBtnText}>{submitting ? "Creating…" : "Create receipt"}</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.overlayBackdrop} onPress={() => setPickerOpen(false)} accessibilityLabel="Close" />
        <Animated.View style={[styles.pickerPanel, { transform: [{ translateX: slideX }] }]}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choose party</Text>
            <Pressable hitSlop={12} onPress={() => setPickerOpen(false)} accessibilityLabel="Close">
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search name, code, phone…"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {pickerLoading && pickerRows.length === 0 ?
            <ActivityIndicator color={tokens.brandUi} style={{ marginTop: 24 }} />
          : <View style={{ flex: 1, minHeight: 0 }}>
              <FlatList
                style={{ flex: 1 }}
                data={pickerRows}
                keyExtractor={(item) => item.customer_id}
                contentContainerStyle={styles.pickerListContent}
                onEndReached={loadMorePicker}
                onEndReachedThreshold={0.35}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCustomer(item);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{partyInitials(item.customer_name)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pickerName}>{item.customer_name}</Text>
                      <Text style={styles.pickerCode}>{item.customer_code}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          }
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  iconBtn: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  muted: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textSecondary },
  errText: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.outward },
  label: {
    marginBottom: 6,
    marginTop: 12,
    fontFamily: "NotoSans-Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  fieldBtn: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    backgroundColor: tokens.bgSubtle,
  },
  fieldText: { fontFamily: "NotoSans-Regular", fontSize: 16, color: tokens.textPrimary },
  placeholder: { fontFamily: "NotoSans-Regular", fontSize: 16, color: tokens.textPlaceholder },
  rupeeRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    backgroundColor: tokens.bgSubtle,
  },
  rupeeSym: {
    fontFamily: "NotoSansMono-Regular",
    fontSize: 16,
    color: tokens.textSecondary,
    marginRight: 6,
  },
  rupeeInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: "NotoSansMono-Regular",
    fontSize: 16,
    color: tokens.textPrimary,
    paddingVertical: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    fontFamily: "NotoSans-Regular",
    fontSize: 16,
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSubtle,
  },
  notes: { minHeight: 96, paddingTop: 10 },
  pmWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pmChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    minHeight: 48,
    justifyContent: "center",
  },
  pmChipOn: { borderColor: tokens.brandUi, backgroundColor: tokens.brandSubtle },
  pmChipText: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textPrimary },
  pmChipTextOn: { fontFamily: "NotoSans-SemiBold", color: tokens.brandText },
  allocSectionTop: { marginTop: 8, borderTopWidth: 1, borderTopColor: tokens.borderDefault, paddingTop: 12 },
  allocSectionKicker: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  allocToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  allocToggleTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
    marginTop: 4,
  },
  allocOptional: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textSecondary },
  allocBody: { marginTop: 12, gap: 10 },
  totalsRow: { flexDirection: "row", gap: 8 },
  totalCard: {
    flex: 1,
    padding: 8,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.bgSubtle,
  },
  totalLbl: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: tokens.textTertiary },
  totalVal: { fontFamily: "NotoSansMono-Regular", fontSize: 14, color: tokens.textPrimary },
  allocRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    gap: 8,
  },
  allocRowTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  allocMeta: { fontFamily: "NotoSansMono-Regular", fontSize: 11, color: tokens.textTertiary },
  allocTitle: { fontFamily: "NotoSans-Regular", fontSize: 13, color: tokens.textPrimary, marginTop: 2 },
  allocDue: { fontFamily: "NotoSansMono-Regular", fontSize: 14, color: tokens.textSecondary, marginTop: 4 },
  partialBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    fontFamily: "NotoSansMono-Regular",
    fontSize: 10,
    letterSpacing: 0.6,
    color: tokens.pending,
    borderWidth: 1,
    borderColor: tokens.pendingBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  allocAmt: {
    marginLeft: 52,
    minHeight: 44,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 8,
    fontFamily: "NotoSansMono-Regular",
    fontSize: 16,
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSubtle,
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
  },
  cancelBtnText: { fontFamily: "NotoSans-SemiBold", fontSize: 15, color: tokens.textPrimary },
  submitBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.brandUi,
  },
  submitBtnText: { fontFamily: "NotoSans-SemiBold", fontSize: 15, color: tokens.textOnBrand },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,26,22,0.45)",
  },
  pickerPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: Math.min(winW, 420),
    maxWidth: "100%",
    flexDirection: "column",
    backgroundColor: tokens.bgSurface,
    borderLeftWidth: 1,
    borderLeftColor: tokens.borderDefault,
    paddingTop: 48,
    paddingHorizontal: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerTitle: { fontFamily: "NotoSerif-SemiBold", fontSize: 18, color: tokens.textPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    minHeight: 48,
    backgroundColor: tokens.bgSubtle,
  },
  searchInput: { flex: 1, fontFamily: "NotoSans-Regular", fontSize: 16, color: tokens.textPrimary, minHeight: 44 },
  pickerListContent: { paddingBottom: 32, paddingTop: 8 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    marginBottom: 8,
    backgroundColor: tokens.bgSubtle,
  },
  pickerRowPressed: { opacity: 0.92 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.brandSubtle,
  },
  avatarText: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 13,
    color: tokens.brandText,
  },
  pickerName: { fontFamily: "NotoSerif-SemiBold", fontSize: 15, color: tokens.textPrimary },
  pickerCode: { fontFamily: "NotoSansMono-Regular", fontSize: 13, color: tokens.textSecondary, marginTop: 2 },
});
