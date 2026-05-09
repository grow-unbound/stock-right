import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
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
import { ChevronLeft, Check, Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MONEY_REFRESH_EVENT,
  fetchUnpaidChargesForLotDelivery,
  insertOperationalPayment,
  listDeliveriesForLot,
  searchLotsQuickPick,
  searchPaymentTypesQuickPick,
  type DeliveryPickRow,
  type LotPickRow,
  type PaymentTypePickRow,
  type UnpaidChargeRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import {
  formatRupeeDigitsForInput,
  formatRupeeInputLive,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { assertIndiaMobileOptional, formatIndianCurrency, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { MobileDatePickerField } from "@/components/ui/MobileDatePickerField";
import { AmountField } from "@/components/ui/AmountField";

const PAGE_SIZE = 25;
const STROKE = 2;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface MobileAddPaymentScreenProps {
  warehouseId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function MobileAddPaymentScreen({ warehouseId: warehouseIdProp, onClose, onDone }: MobileAddPaymentScreenProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const insets = useSafeAreaInsets();
  const [warehouseId, setWarehouseId] = useState<string | null>(warehouseIdProp ?? null);

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

  const [paymentDate, setPaymentDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState(todayIso);
  const [amountStr, setAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [paymentType, setPaymentType] = useState<PaymentTypePickRow | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"PAID" | "PENDING">("PAID");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [lot, setLot] = useState<LotPickRow | null>(null);
  const [delivery, setDelivery] = useState<DeliveryPickRow | null>(null);
  const [unpaidCharges, setUnpaidCharges] = useState<UnpaidChargeRow[]>([]);
  const [chargePayStr, setChargePayStr] = useState<Record<string, string>>({});
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitError, setSubmitError] = useState<{ title: string; message: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [typeModal, setTypeModal] = useState(false);
  const [lotModal, setLotModal] = useState(false);
  const [delModal, setDelModal] = useState(false);
  const [typeQ, setTypeQ] = useState("");
  const [lotQ, setLotQ] = useState("");
  const debTypeQ = useDebouncedValue(typeQ.trim(), 300);
  const debLotQ = useDebouncedValue(lotQ.trim(), 300);
  const [typeRows, setTypeRows] = useState<PaymentTypePickRow[]>([]);
  const [lotRows, setLotRows] = useState<LotPickRow[]>([]);
  const [delRows, setDelRows] = useState<DeliveryPickRow[]>([]);
  const [delLoading, setDelLoading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isStaff = paymentType?.category === "STAFF";
  const isStockMovement = paymentType?.category === "STOCK_MOVEMENT";
  const stockPaid = isStockMovement && status === "PAID";

  const chargeSum = useMemo(() => {
    let s = 0;
    for (const row of unpaidCharges) {
      const n = parseIndianRupeeInput(chargePayStr[row.id] ?? "");
      if (n !== null && n > 0) s += n;
    }
    return round2(s);
  }, [unpaidCharges, chargePayStr]);

  useEffect(() => {
    if (stockPaid) {
      setAmountStr(chargeSum > 0 ? formatRupeeDigitsForInput(chargeSum) : "");
    }
  }, [stockPaid, chargeSum]);

  useEffect(() => {
    if (!isStockMovement) {
      setLot(null);
      setDelivery(null);
      setUnpaidCharges([]);
      setChargePayStr({});
    }
  }, [isStockMovement]);

  useEffect(() => {
    if (!isStaff) {
      setPartyName("");
      setPartyPhone("");
    }
  }, [isStaff]);

  useEffect(() => {
    if (!stockPaid || !lot || !delivery) {
      setUnpaidCharges([]);
      setChargePayStr({});
      return;
    }
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchUnpaidChargesForLotDelivery(supabase, {
          lotId: lot.lot_id,
          deliveryId: delivery.delivery_id,
        });
        if (!cancelled) {
          setUnpaidCharges(rows);
          setChargePayStr({});
        }
      } finally {
        if (!cancelled) setLoadingCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockPaid, lot, delivery, supabase]);

  const refreshTypes = useCallback(async () => {
    if (!warehouseId) return;
    const { rows } = await searchPaymentTypesQuickPick(supabase, {
      warehouseId,
      q: debTypeQ,
      limit: PAGE_SIZE,
      offset: 0,
    });
    setTypeRows(rows);
  }, [debTypeQ, supabase, warehouseId]);

  const refreshLots = useCallback(async () => {
    if (!warehouseId) return;
    const { rows } = await searchLotsQuickPick(supabase, {
      warehouseId,
      q: debLotQ,
      limit: PAGE_SIZE,
      offset: 0,
    });
    setLotRows(rows);
  }, [debLotQ, supabase, warehouseId]);

  useEffect(() => {
    if (!typeModal || !warehouseId) return;
    void refreshTypes();
  }, [typeModal, warehouseId, refreshTypes]);

  useEffect(() => {
    if (!lotModal || !warehouseId) return;
    void refreshLots();
  }, [lotModal, warehouseId, refreshLots]);

  useEffect(() => {
    if (!delModal || !lot) {
      setDelRows([]);
      return;
    }
    setDelLoading(true);
    void listDeliveriesForLot(supabase, { lotId: lot.lot_id })
      .then(setDelRows)
      .finally(() => setDelLoading(false));
  }, [delModal, lot, supabase]);

  async function handleSubmit() {
    if (!warehouseId || !paymentType) return;
    let amount = parseIndianRupeeInput(amountStr);
    if (stockPaid) amount = chargeSum;
    if (amount === null || amount <= 0) return;

    const chargeLines =
      stockPaid ?
        unpaidCharges
          .map((row) => {
            const n = parseIndianRupeeInput(chargePayStr[row.id] ?? "");
            return {
              transactionChargeId: row.id,
              amount: n !== null && n > 0 ? round2(n) : 0,
            };
          })
          .filter((l) => l.amount > 0)
      : undefined;

    if (isStockMovement && (!lot || !delivery)) return;
    if (stockPaid && unpaidCharges.length === 0) return;

    if (isStaff) {
      if (partyPhone.trim() === "") {
        setSubmitError({ title: "Phone required", message: "Enter employee phone." });
        return;
      }
      try {
        assertIndiaMobileOptional(partyPhone, "Employee phone");
      } catch (e: unknown) {
        setSubmitError({
          title: "Invalid phone",
          message: e instanceof Error ? e.message : "Check the number.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      await insertOperationalPayment(supabase, {
        warehouseId,
        paymentTypeId: paymentType.id,
        paymentTypeCategory: paymentType.category,
        status,
        amount,
        paymentMethod,
        paymentDateIso: paymentDate,
        dueDateIso: status === "PENDING" ? dueDate : null,
        notes: notes.trim() === "" ? null : notes.trim(),
        partyName: isStaff ? (partyName.trim() === "" ? null : partyName.trim()) : null,
        partyPhone: isStaff ? (partyPhone.trim() === "" ? null : partyPhone.trim()) : null,
        lotId: isStockMovement ? lot?.lot_id ?? null : null,
        deliveryId: isStockMovement ? delivery?.delivery_id ?? null : null,
        chargePayLines: chargeLines,
      });
      DeviceEventEmitter.emit(MONEY_REFRESH_EVENT);
      onDone();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            setDiscardOpen(true);
          }}
          style={styles.headerBtn}
        >
          <ChevronLeft size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add Payment
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <Text style={styles.fieldLabel}>Date</Text>
        <View style={styles.block}>
          <MobileDatePickerField value={paymentDate} onChange={setPaymentDate} />
        </View>
        <View style={styles.block}>
          <AmountField label="Amount" value={amountStr} onChange={setAmountStr} editable={!stockPaid} />
        </View>
        <Text style={styles.sectionLabel}>Payment method</Text>
        <View style={styles.pmWrap}>
          {PAYMENT_METHOD_VALUES.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                void Haptics.selectionAsync();
                setPaymentMethod(m);
              }}
              style={[styles.pmChip, paymentMethod === m && styles.pmChipOn]}
            >
              <Text style={[styles.pmChipText, paymentMethod === m && styles.pmChipTextOn]}>
                {paymentMethodLabel(m)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Payment type</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setTypeModal(true)}>
          <Text style={paymentType ? styles.pickerVal : styles.pickerPh}>
            {paymentType ? paymentType.name : "Tap to choose"}
          </Text>
        </Pressable>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={tokens.textPlaceholder}
          multiline
          style={styles.textarea}
        />
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.pillRow}>
          {(["PAID", "PENDING"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[styles.pill, status === s ? styles.pillOn : styles.pillOff]}
            >
              <Text style={[styles.pillTxt, status === s ? styles.pillTxtOn : styles.pillTxtOff]}>
                {s === "PAID" ? "Paid" : "Pending"}
              </Text>
            </Pressable>
          ))}
        </View>
        {status === "PENDING" ?
          <>
            <Text style={styles.fieldLabel}>Due date</Text>
            <View style={styles.block}>
              <MobileDatePickerField value={dueDate} onChange={setDueDate} />
            </View>
          </>
        : null}
        {isStaff ?
          <>
            <Text style={styles.fieldLabel}>Employee name</Text>
            <TextInput value={partyName} onChangeText={setPartyName} style={styles.input} />
            <Text style={styles.fieldLabel}>Employee phone</Text>
            <TextInput
              value={partyPhone}
              onChangeText={setPartyPhone}
              keyboardType="number-pad"
              style={styles.input}
            />
          </>
        : null}
        {isStockMovement ?
          <>
            <Text style={styles.fieldLabel}>Lot</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setLotModal(true)}>
              <Text style={lot ? styles.pickerVal : styles.pickerPh}>{lot ? lot.lot_number : "Search lots"}</Text>
            </Pressable>
            <Text style={styles.fieldLabel}>Delivery</Text>
            <Pressable style={styles.pickerBtn} disabled={!lot} onPress={() => setDelModal(true)}>
              <Text style={delivery ? styles.pickerVal : styles.pickerPh}>
                {delivery ? `${delivery.delivery_date} · ${delivery.num_bags_out} bags` : "Choose delivery"}
              </Text>
            </Pressable>
            {stockPaid ?
              <View style={styles.chargeBox}>
                <Text style={styles.sectionLabel}>Stock movement charges</Text>
                {loadingCharges ?
                  <ActivityIndicator color={tokens.brandUi} />
                : unpaidCharges.length === 0 ?
                  <Text style={styles.muted}>No unpaid charges.</Text>
                : (
                  unpaidCharges.map((row) => {
                    const remaining = round2(row.chargeAmount - row.legacyAmountPaid);
                    return (
                      <View key={row.id} style={styles.chargeRow}>
                        <Text style={styles.chargeName}>{row.displayName}</Text>
                        <Text style={styles.muted}>Due {formatIndianCurrency(remaining)}</Text>
                        <TextInput
                          value={chargePayStr[row.id] ?? ""}
                          onChangeText={(t) =>
                            setChargePayStr((prev) => ({ ...prev, [row.id]: formatRupeeInputLive(t) }))
                          }
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                    );
                  })
                )}
                <Text style={styles.totalLine}>Total {formatIndianCurrency(chargeSum)}</Text>
              </View>
            : null}
          </>
        : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Pressable style={styles.cancelFooter} onPress={() => setDiscardOpen(true)}>
          <X size={18} color={tokens.textPrimary} strokeWidth={STROKE} />
          <Text style={styles.cancelFooterTxt}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.submitFooter, submitting && { opacity: 0.6 }]}
          disabled={submitting}
          onPress={() => void handleSubmit()}
        >
          <Check size={18} color={tokens.textOnBrand} strokeWidth={STROKE} />
          <Text style={styles.submitFooterTxt}>{submitting ? "Creating…" : "Create Payment"}</Text>
        </Pressable>
      </View>

      <Modal visible={typeModal} animationType="slide" onRequestClose={() => setTypeModal(false)}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Payment type</Text>
            <Pressable onPress={() => setTypeModal(false)} style={styles.headerBtn}>
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={typeQ}
              onChangeText={setTypeQ}
              placeholder="Search"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInp}
            />
          </View>
          <FlatList
            data={typeRows}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.listRow}
                onPress={() => {
                  setPaymentType(item);
                  setTypeModal(false);
                }}
              >
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.muted}>{item.category}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal visible={lotModal} animationType="slide" onRequestClose={() => setLotModal(false)}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Lot</Text>
            <Pressable onPress={() => setLotModal(false)} style={styles.headerBtn}>
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={lotQ}
              onChangeText={setLotQ}
              placeholder="Search"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInp}
            />
          </View>
          <FlatList
            data={lotRows}
            keyExtractor={(i) => i.lot_id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.listRow}
                onPress={() => {
                  setLot(item);
                  setDelivery(null);
                  setLotModal(false);
                }}
              >
                <Text style={styles.listTitle}>{item.lot_number}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {item.customer_name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal visible={delModal} animationType="slide" onRequestClose={() => setDelModal(false)}>
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Delivery</Text>
            <Pressable onPress={() => setDelModal(false)} style={styles.headerBtn}>
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          {delLoading ?
            <ActivityIndicator color={tokens.brandUi} style={{ marginTop: 24 }} />
          : (
            <FlatList
              data={delRows}
              keyExtractor={(i) => i.delivery_id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listRow}
                  onPress={() => {
                    setDelivery(item);
                    setDelModal(false);
                  }}
                >
                  <Text style={styles.listTitle}>
                    {item.delivery_date} · {item.num_bags_out} bags
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>

      <BrandedAlertModal
        visible={discardOpen}
        title="Discard changes?"
        message="You will lose anything not saved."
        secondaryLabel="Keep editing"
        onSecondary={() => setDiscardOpen(false)}
        confirmLabel="Discard"
        primaryDestructive
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
      <BrandedAlertModal
        visible={submitError !== null}
        title={submitError?.title ?? ""}
        message={submitError?.message ?? ""}
        confirmLabel="OK"
        onConfirm={() => setSubmitError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    paddingHorizontal: 4,
  },
  headerBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
  },
  scroll: { flex: 1 },
  block: { paddingHorizontal: 16, marginTop: 12 },
  sectionLabel: {
    marginTop: 16,
    marginHorizontal: 16,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
    fontWeight: "600",
  },
  fieldLabel: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 12,
    letterSpacing: 0.06,
    textTransform: "uppercase",
    color: tokens.textTertiary,
    fontWeight: "500",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  pmWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
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
  pill: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  pillOn: { borderColor: tokens.brandUi, backgroundColor: tokens.brandSubtle },
  pillOff: { borderColor: tokens.borderDefault, backgroundColor: tokens.bgSubtle },
  pillTxt: { fontSize: 16 },
  pillTxtOn: { color: tokens.brandText, fontWeight: "600" },
  pillTxtOff: { color: tokens.textSecondary },
  pickerBtn: {
    marginHorizontal: 16,
    marginTop: 6,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  pickerVal: { fontSize: 16, color: tokens.textPrimary },
  pickerPh: { fontSize: 16, color: tokens.textPlaceholder },
  textarea: {
    marginHorizontal: 16,
    marginTop: 6,
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    padding: 12,
    fontSize: 16,
    color: tokens.textPrimary,
    textAlignVertical: "top",
  },
  input: {
    marginHorizontal: 16,
    marginTop: 6,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    paddingHorizontal: 12,
    fontSize: 16,
    color: tokens.textPrimary,
  },
  chargeBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  chargeRow: { marginBottom: 12 },
  chargeName: { fontSize: 15, fontWeight: "600", color: tokens.textPrimary },
  muted: { fontSize: 13, color: tokens.textSecondary, marginTop: 4 },
  totalLine: { marginTop: 8, fontSize: 15, fontWeight: "700", color: tokens.textPrimary },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  cancelFooter: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
  },
  cancelFooterTxt: { fontSize: 16, fontWeight: "600", color: tokens.textPrimary },
  submitFooter: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: tokens.brandUi,
  },
  submitFooterTxt: { fontSize: 16, fontWeight: "600", color: tokens.textOnBrand },
  modal: { flex: 1, backgroundColor: tokens.bgPage },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: tokens.textPrimary, paddingVertical: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
  },
  searchInp: { flex: 1, fontSize: 16, color: tokens.textPrimary },
  listRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  listTitle: { fontSize: 16, fontWeight: "600", color: tokens.textPrimary },
});
