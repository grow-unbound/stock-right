import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Check, ChevronDown, Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createReceiptWithAllocations,
  fetchOutstandingAllocatable,
  searchCustomersQuickPick,
  type OutstandingAllocatableRow,
  type PartiesTabRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import {
  buildReceiptAllocationsLotView,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { formatDate, formatIndianCurrency, partyInitials, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { MobileDatePickerField } from "@/components/ui/MobileDatePickerField";
import { AmountField } from "@/components/ui/AmountField";

const PAGE_SIZE = 25;
const MONEY_FEED_REFRESH_EVENT = "sr-money-refresh";
const STROKE = 2;
const winW = Dimensions.get("window").width;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lotDateLabel(iso: string): string {
  if (!iso || iso.trim() === "") return "—";
  return formatDate(iso);
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
  const [notes, setNotes] = useState("");
  const [allocOpen, setAllocOpen] = useState(false);
  const [outstanding, setOutstanding] = useState<OutstandingAllocatableRow[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  type ReceiptDialog =
    | { kind: "none" }
    | { kind: "discard" }
    | { kind: "ok"; title: string; message?: string; onOk: () => void }
    | { kind: "error"; title: string; message: string };
  const [dialog, setDialog] = useState<ReceiptDialog>({ kind: "none" });

  const receiptAmount = parseIndianRupeeInput(amountStr) ?? 0;
  const allocLotView = useMemo(
    () => buildReceiptAllocationsLotView(outstanding, receiptAmount),
    [outstanding, receiptAmount]
  );

  useEffect(() => {
    if (!allocOpen || !customer?.customer_id || !warehouseId) {
      setOutstanding([]);
      setOutstandingError(null);
      setLoadingLines(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingLines(true);
      setOutstandingError(null);
      try {
        const lines = await fetchOutstandingAllocatable(supabase, warehouseId, customer.customer_id);
        if (cancelled) return;
        setOutstanding(lines);
      } catch {
        if (!cancelled) {
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

  const dirty =
    customer !== null ||
    amountStr.trim() !== "" ||
    receiptDate !== todayIso() ||
    paymentMethod !== "UPI" ||
    notes.trim() !== "" ||
    allocOpen;

  function requestClose() {
    if (dirty) {
      setDialog({ kind: "discard" });
      return;
    }
    onClose();
  }

  function closeDialog() {
    setDialog({ kind: "none" });
  }

  async function submit() {
    if (!warehouseId || !customer) {
      setDialog({
        kind: "ok",
        title: "Choose a party",
        onOk: closeDialog,
      });
      return;
    }
    const amt = parseIndianRupeeInput(amountStr);
    if (amt === null || amt <= 0) {
      setDialog({
        kind: "ok",
        title: "Enter a valid amount",
        onOk: closeDialog,
      });
      return;
    }

    const view = buildReceiptAllocationsLotView(outstanding, amt);
    const lines =
      allocOpen && view.lineStates.some((s) => s.allocated > 0.005) ?
        view.lineStates
          .filter((s) => s.allocated > 0.005)
          .map((s) =>
            s.row.line_kind === "rent" ?
              { rent_accrual_id: s.row.line_id, amount: s.allocated }
            : { charge_id: s.row.line_id, amount: s.allocated }
          )
      : [];

    const sumAlloc = lines.reduce((s, l) => s + l.amount, 0);
    if (sumAlloc > amt + 0.01) {
      setDialog({
        kind: "ok",
        title: "Allocated amounts cannot exceed the receipt total.",
        onOk: closeDialog,
      });
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
        notes: notes.trim() === "" ? null : notes.trim(),
        allocationLines: lines,
      });
      DeviceEventEmitter.emit(MONEY_FEED_REFRESH_EVENT);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDialog({
        kind: "ok",
        title: "Receipt recorded",
        onOk: () => {
          closeDialog();
          onDone();
        },
      });
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = e instanceof Error ? e.message : "Could not save receipt.";
      setDialog({ kind: "error", title: "Could not save", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const co = allocLotView.currentOutstanding;
  const netSince =
    allocLotView.netOutstanding.oldestLodgementDate ?
      ` · since ${formatDate(allocLotView.netOutstanding.oldestLodgementDate)}`
    : "";

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
          <ChevronLeft size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
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

        <AmountField label="Amount" value={amountStr} onChange={setAmountStr} />

        <Text style={styles.label}>Date received</Text>
        <MobileDatePickerField value={receiptDate} onChange={setReceiptDate} />

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

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
          placeholder="Optional note"
          placeholderTextColor={tokens.textPlaceholder}
        />

        <View style={styles.allocCard}>
          <Pressable
            style={styles.allocHeaderBtn}
            onPress={() => {
              void Haptics.selectionAsync();
              setAllocOpen((v) => !v);
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.allocCardKicker}>Receipt allocations</Text>
              <Text style={styles.allocCardTitle}>
                Apply to charges & rent <Text style={styles.allocOptional}>(optional)</Text>
              </Text>
            </View>
            <ChevronDown
              size={20}
              color={tokens.textTertiary}
              strokeWidth={STROKE}
              style={allocOpen ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </Pressable>

          {allocOpen ?
            <View style={styles.allocInner}>
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
              : (
                <>
                  <View style={styles.currentOutstandingBox}>
                    <View style={styles.dueLine}>
                      <Text style={styles.dueLineLbl}>Charges due</Text>
                      <Text style={styles.dueLineVal}>{formatIndianCurrency(co.charges)}</Text>
                    </View>
                    <View style={styles.dueLine}>
                      <Text style={styles.dueLineLbl}>Rents due</Text>
                      <Text style={styles.dueLineVal}>{formatIndianCurrency(co.rents)}</Text>
                    </View>
                    <View style={[styles.dueLine, styles.dueLineTotalRow]}>
                      <Text style={styles.dueLineTotalLbl}>Current outstanding</Text>
                      <Text style={styles.dueLineTotalVal}>{formatIndianCurrency(co.total)}</Text>
                    </View>
                  </View>

                  {receiptAmount <= 0 ?
                    <Text style={styles.hintMuted}>
                      Oldest charges and rents are settled first (FIFO). Enter an amount to see how this receipt applies.
                    </Text>
                  : null}

                  {allocLotView.displayRows.length > 0 ?
                    <View style={styles.settledList}>
                      {allocLotView.displayRows.map((row, idx) => (
                        <View key={`${row.kind}-${row.lotId}-${idx}`} style={styles.settleCard}>
                          {row.kind === "preview_unsettled" ?
                            <>
                              <View style={styles.settleMetaRow}>
                                <Text style={styles.settleLotMeta}>Lot {row.lotNumber}</Text>
                                <Text style={styles.settleLotDate}>{lotDateLabel(row.lotLodgementDate)}</Text>
                              </View>
                              <Text style={styles.settleProduct}>{row.productName}</Text>
                              <Text style={styles.settleBags}>
                                {row.balanceBags}/{row.originalBags} bags remaining
                              </Text>
                              <Text style={styles.settleSub}>Not settled until you enter an amount</Text>
                              <View style={styles.settleStatusRow}>
                                <View style={styles.pillPending}>
                                  <Text style={styles.pillPendingText}>PENDING</Text>
                                </View>
                              </View>
                            </>
                          : (
                            <>
                              <View style={styles.settleMetaRow}>
                                <Text style={styles.settleLotMeta}>Lot {row.lotNumber}</Text>
                                <Text style={styles.settleLotDate}>{lotDateLabel(row.lotLodgementDate)}</Text>
                              </View>
                              <Text style={styles.settleProduct}>{row.productName}</Text>
                              <Text style={styles.settleBags}>
                                {row.balanceBags}/{row.originalBags} bags remaining
                              </Text>
                              <View style={styles.settleDivider} />
                              <View style={styles.settleMonoBlock}>
                                <View style={styles.settleRow}>
                                  <Text style={styles.settleLbl}>Charges due</Text>
                                  <Text style={styles.settleAmt}>{formatIndianCurrency(row.chargesDue)}</Text>
                                </View>
                                <View style={styles.settleRow}>
                                  <Text style={styles.settleLbl}>Rents due</Text>
                                  <Text style={styles.settleAmt}>{formatIndianCurrency(row.rentsDue)}</Text>
                                </View>
                                <View style={styles.settleRow}>
                                  <Text style={styles.settleLblBold}>Total due</Text>
                                  <Text style={styles.settleAmtBold}>{formatIndianCurrency(row.totalDue)}</Text>
                                </View>
                              </View>
                              <View style={styles.settleStatusRow}>
                                {row.kind === "full" ?
                                  <View style={styles.pillNeutral}>
                                    <Text style={styles.pillNeutralText}>FULL</Text>
                                  </View>
                                : (
                                  <View style={styles.pillPending}>
                                    <Text style={styles.pillPendingText}>PARTIAL</Text>
                                  </View>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  : receiptAmount > 0 ?
                    <Text style={styles.hintMuted}>Nothing settled from this receipt.</Text>
                  : null}

                  <View style={styles.netBox}>
                    <Text style={styles.netHeader}>
                      <Text style={styles.netLabel}>NET OUTSTANDING </Text>
                      <Text style={styles.netLotsBracket}>({allocLotView.netOutstanding.lotCount} lots)</Text>
                      <Text style={styles.netSince}>{netSince}</Text>
                    </Text>
                    <View style={styles.settleRow}>
                      <Text style={styles.settleLbl}>Charges due</Text>
                      <Text style={styles.settleAmt}>{formatIndianCurrency(allocLotView.netOutstanding.chargesDue)}</Text>
                    </View>
                    <View style={styles.settleRow}>
                      <Text style={styles.settleLbl}>Rents due</Text>
                      <Text style={styles.settleAmt}>{formatIndianCurrency(allocLotView.netOutstanding.rentsDue)}</Text>
                    </View>
                    <View style={styles.settleRow}>
                      <Text style={styles.settleLblBold}>Total due</Text>
                      <Text style={styles.settleAmtBold}>{formatIndianCurrency(allocLotView.netOutstanding.totalDue)}</Text>
                    </View>
                  </View>
                </>
              )
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

      {dialog.kind === "discard" ?
        <BrandedAlertModal
          visible
          title="Discard changes?"
          message="You have unsaved entries."
          secondaryLabel="Keep editing"
          onSecondary={closeDialog}
          confirmLabel="Discard"
          primaryDestructive
          onConfirm={() => {
            closeDialog();
            onClose();
          }}
        />
      : null}
      {dialog.kind === "ok" ?
        <BrandedAlertModal
          visible
          title={dialog.title}
          message={dialog.message}
          onConfirm={dialog.onOk}
        />
      : null}
      {dialog.kind === "error" ?
        <BrandedAlertModal visible title={dialog.title} message={dialog.message} onConfirm={closeDialog} />
      : null}
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
  allocCard: {
    marginTop: tokens.sp3,
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  allocHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  allocCardKicker: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  allocCardTitle: {
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
    marginTop: 4,
  },
  allocOptional: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textSecondary },
  allocInner: { marginTop: 10, gap: 12, borderTopWidth: 1, borderTopColor: tokens.borderDefault, paddingTop: 12 },
  currentOutstandingBox: {
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.bgSubtle,
    padding: 12,
    gap: 8,
  },
  dueLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  dueLineLbl: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  dueLineVal: { fontFamily: "NotoSansMono-Regular", fontSize: 14, color: tokens.textPrimary },
  dueLineTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
  },
  dueLineTotalLbl: { fontFamily: "NotoSans-SemiBold", fontSize: 12, color: tokens.textPrimary },
  dueLineTotalVal: { fontFamily: "NotoSansMono-Regular", fontSize: 15, fontWeight: "600", color: tokens.textPrimary },
  hintMuted: { fontFamily: "NotoSans-Regular", fontSize: 13, color: tokens.textSecondary },
  settledList: { gap: 12 },
  settleCard: {
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    gap: 8,
  },
  settleLotMeta: { fontFamily: "NotoSansMono-Regular", fontSize: 13, color: tokens.textPrimary, fontWeight: "600" },
  settleMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  settleLotDate: { fontFamily: "NotoSansMono-Regular", fontSize: 11, color: tokens.textTertiary },
  settleProduct: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textSecondary },
  settleSub: { fontFamily: "NotoSans-Regular", fontSize: 12, color: tokens.textSecondary },
  settleBags: { fontFamily: "NotoSansMono-Regular", fontSize: 12, color: tokens.textTertiary },
  settleDivider: { height: 1, backgroundColor: tokens.borderDefault, marginVertical: 4 },
  settleMonoBlock: { gap: 6 },
  settleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  settleLbl: { fontFamily: "NotoSans-Medium", fontSize: 11, letterSpacing: 0.5, color: tokens.textTertiary },
  settleAmt: { fontFamily: "NotoSansMono-Regular", fontSize: 15, color: tokens.textPrimary },
  settleLblBold: { fontFamily: "NotoSans-SemiBold", fontSize: 13, color: tokens.textPrimary },
  settleAmtBold: { fontFamily: "NotoSansMono-Regular", fontSize: 16, fontWeight: "600", color: tokens.textPrimary },
  settleStatusRow: { alignItems: "center", marginTop: 2 },
  pillNeutral: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tokens.bgSubtle,
  },
  pillNeutralText: {
    fontFamily: "NotoSansMono-Regular",
    fontSize: 10,
    letterSpacing: 0.6,
    color: tokens.textSecondary,
  },
  pillPending: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.pendingBorder,
    backgroundColor: tokens.pendingBg,
  },
  pillPendingText: {
    fontFamily: "NotoSansMono-Regular",
    fontSize: 10,
    letterSpacing: 0.6,
    color: tokens.pending,
  },
  netBox: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    gap: 6,
  },
  netHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 4 },
  netLabel: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  netLotsBracket: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.2,
    color: tokens.textTertiary,
  },
  netSince: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    color: tokens.textSecondary,
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
    backgroundColor: tokens.overlayScrim,
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
