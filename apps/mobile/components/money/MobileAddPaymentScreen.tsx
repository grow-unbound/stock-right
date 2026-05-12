import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceEventEmitter, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Check, Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MONEY_REFRESH_EVENT, insertOperationalPayment, searchPaymentTypesQuickPick, type PaymentTypePickRow } from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { parseIndianRupeeInput, PAYMENT_METHOD_VALUES, paymentMethodLabel, type PaymentMethodValue } from "@stockright/shared/receipt";
import { assertIndiaMobileOptional, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { MobileDatePickerField } from "@/components/ui/MobileDatePickerField";
import { AmountField } from "@/components/ui/AmountField";

const PAGE_SIZE = 25;
const STROKE = 2;
const EXCLUDE_PAYMENT_CATEGORIES = ["STOCK_MOVEMENT"] as const;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  const [amountStr, setAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [paymentType, setPaymentType] = useState<PaymentTypePickRow | null>(null);
  const [notes, setNotes] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [submitError, setSubmitError] = useState<{ title: string; message: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [typeModal, setTypeModal] = useState(false);
  const [typeQ, setTypeQ] = useState("");
  const debTypeQ = useDebouncedValue(typeQ.trim(), 300);
  const [typeRows, setTypeRows] = useState<PaymentTypePickRow[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isStaff = paymentType?.category === "STAFF";

  useEffect(() => {
    if (!isStaff) {
      setPartyName("");
      setPartyPhone("");
    }
  }, [isStaff]);

  const refreshTypes = useCallback(async () => {
    if (!warehouseId) return;
    const { rows } = await searchPaymentTypesQuickPick(supabase, {
      warehouseId,
      q: debTypeQ,
      limit: PAGE_SIZE,
      offset: 0,
      excludeCategories: EXCLUDE_PAYMENT_CATEGORIES,
    });
    setTypeRows(rows);
  }, [debTypeQ, supabase, warehouseId]);

  useEffect(() => {
    if (!typeModal || !warehouseId) return;
    void refreshTypes();
  }, [typeModal, warehouseId, refreshTypes]);

  async function handleSubmit() {
    if (!warehouseId || !paymentType) return;
    const amount = parseIndianRupeeInput(amountStr);
    if (amount === null || amount <= 0) return;

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
        status: "PAID",
        amount,
        paymentMethod,
        paymentDateIso: paymentDate,
        dueDateIso: null,
        notes: notes.trim() === "" ? null : notes.trim(),
        partyName: isStaff ? (partyName.trim() === "" ? null : partyName.trim()) : null,
        partyPhone: isStaff ? (partyPhone.trim() === "" ? null : partyPhone.trim()) : null,
        lotId: null,
        deliveryId: null,
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
          <AmountField label="Amount" value={amountStr} onChange={setAmountStr} />
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
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional note"
          placeholderTextColor={tokens.textPlaceholder}
          style={styles.input}
        />
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
  muted: { fontSize: 13, color: tokens.textSecondary, marginTop: 4 },
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
