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
import { ChevronDown, ChevronLeft, Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchLotOutstandingTotals,
  fetchProductChargesForProduct,
  insertDeliveryWithCharges,
  searchCustomersQuickPick,
  searchLotsQuickPick,
  STOCK_REFRESH_EVENT,
  type LotPickRow,
  type PartiesTabRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import {
  formatRupeeInputLive,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import {
  buildInitialNumBagsByLine,
  isChargeNumBagsLockedToLot,
  syncLockedNumBagsToLotBags,
} from "@stockright/shared/lot-charge-form";
import { buildSyntheticDeliveryRow } from "@stockright/shared/stock-tab";
import { formatIndianCurrency2, partyInitials, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { MobileDatePickerField } from "@/components/ui/MobileDatePickerField";
import { AmountField } from "@/components/ui/AmountField";

const PAGE_SIZE = 25;
const STROKE = 2;
const DUES_EPSILON = 0.01;

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ChargeDef = {
  productChargeTypeId: string;
  chargesPerBag: number;
  displayName: string;
  code: string;
};

function mergeCust(a: PartiesTabRow[], b: PartiesTabRow[]): PartiesTabRow[] {
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

function mergeLots(a: LotPickRow[], b: LotPickRow[]): LotPickRow[] {
  const seen = new Set(a.map((r) => r.lot_id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.lot_id)) {
      seen.add(row.lot_id);
      out.push(row);
    }
  }
  return out;
}

interface MobileAddDeliveryScreenProps {
  warehouseId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function MobileAddDeliveryScreen({
  warehouseId: warehouseIdProp,
  onClose,
  onDone,
}: MobileAddDeliveryScreenProps) {
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

  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [lot, setLot] = useState<LotPickRow | null>(null);
  const [custModal, setCustModal] = useState(false);
  const [lotModal, setLotModal] = useState(false);
  const [custQ, setCustQ] = useState("");
  const [lotQ, setLotQ] = useState("");
  const debCustQ = useDebouncedValue(custQ.trim(), 320);
  const debLotQ = useDebouncedValue(lotQ.trim(), 320);
  const [custRows, setCustRows] = useState<PartiesTabRow[]>([]);
  const [lotRows, setLotRows] = useState<LotPickRow[]>([]);
  const [lotTotalCount, setLotTotalCount] = useState<number | null>(null);
  const [custLoading, setCustLoading] = useState(false);
  const [lotLoading, setLotLoading] = useState(false);
  const [bagsStr, setBagsStr] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [chargeDefs, setChargeDefs] = useState<ChargeDef[]>([]);
  const [numBagsByLine, setNumBagsByLine] = useState<Record<string, string>>({});
  const [paidNowStr, setPaidNowStr] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [transportOpen, setTransportOpen] = useState(true);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState<{ title: string; message: string } | null>(null);
  const [outstanding, setOutstanding] = useState({ charges: 0, rents: 0 });
  const [outstandingLoading, setOutstandingLoading] = useState(false);

  useEffect(() => {
    if (!lot || !customer || !warehouseId) {
      setOutstanding({ charges: 0, rents: 0 });
      return;
    }
    let cancelled = false;
    setOutstandingLoading(true);
    void fetchLotOutstandingTotals(supabase, warehouseId, customer.customer_id, lot.lot_id)
      .then((t) => {
        if (!cancelled) setOutstanding({ charges: t.chargesDue, rents: t.rentsDue });
      })
      .catch(() => {
        if (!cancelled) setOutstanding({ charges: 0, rents: 0 });
      })
      .finally(() => {
        if (!cancelled) setOutstandingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lot, customer, supabase, warehouseId]);

  const fetchCust = useCallback(
    async (offset: number, reset: boolean) => {
      if (!warehouseId) return;
      setCustLoading(true);
      try {
        const { rows } = await searchCustomersQuickPick(supabase, {
          warehouseId,
          q: debCustQ,
          limit: PAGE_SIZE,
          offset,
        });
        setCustRows((prev) => (reset ? rows : mergeCust(prev, rows)));
      } finally {
        setCustLoading(false);
      }
    },
    [debCustQ, supabase, warehouseId]
  );

  const fetchLots = useCallback(
    async (offset: number, reset: boolean) => {
      if (!warehouseId || !customer) return;
      setLotLoading(true);
      try {
        const { rows, count } = await searchLotsQuickPick(supabase, {
          warehouseId,
          q: debLotQ,
          limit: PAGE_SIZE,
          offset,
          customerId: customer.customer_id,
          statusIn: ["ACTIVE", "STALE"],
          positiveBalanceOnly: true,
        });
        if (count !== null) setLotTotalCount(count);
        setLotRows((prev) => (reset ? rows : mergeLots(prev, rows)));
      } finally {
        setLotLoading(false);
      }
    },
    [debLotQ, supabase, warehouseId, customer]
  );

  useEffect(() => {
    if (!custModal) return;
    setCustRows([]);
    void fetchCust(0, true);
  }, [custModal, debCustQ, fetchCust]);

  useEffect(() => {
    if (!lotModal || !customer) return;
    setLotRows([]);
    setLotTotalCount(null);
    void fetchLots(0, true);
  }, [lotModal, debLotQ, fetchLots, customer]);

  useEffect(() => {
    if (!lot) {
      setChargeDefs([]);
      setNumBagsByLine({});
      setPaidNowStr({});
      setChargesOpen(false);
      return;
    }
    setChargesOpen(false);
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchProductChargesForProduct(supabase, lot.product_id);
        if (!cancelled) {
          setChargeDefs(rows);
          setPaidNowStr({});
          const n = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
          setNumBagsByLine(buildInitialNumBagsByLine(rows, Number.isFinite(n) && n > 0 ? n : 0));
        }
      } finally {
        if (!cancelled) setLoadingCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lot, supabase]);

  useEffect(() => {
    if (lot && !loadingCharges) {
      setChargesOpen(true);
    }
  }, [lot, loadingCharges]);

  const bagsNum = useMemo(() => {
    const n = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [bagsStr]);

  useEffect(() => {
    setNumBagsByLine((prev) => syncLockedNumBagsToLotBags(prev, chargeDefs, bagsNum));
  }, [bagsNum, chargeDefs]);

  const chargePreview = useMemo(() => {
    return chargeDefs.map((l) => {
      const rawBags = numBagsByLine[l.productChargeTypeId] ?? "0";
      const nb = Math.max(0, Math.floor(Number.parseInt(rawBags.replace(/\D/g, "") || "0", 10)));
      const total = round2(l.chargesPerBag * nb);
      const raw = paidNowStr[l.productChargeTypeId] ?? "";
      const paid = parseIndianRupeeInput(raw);
      const paidN = paid !== null && paid > 0 ? round2(Math.min(paid, total)) : 0;
      return { ...l, lineNumBags: nb, total, paidN };
    });
  }, [chargeDefs, numBagsByLine, paidNowStr]);

  const anyPayNow = useMemo(() => chargePreview.some((l) => l.paidN > 0), [chargePreview]);

  const chargeTotals = useMemo(() => {
    const receivable = chargePreview.reduce((s, l) => s + l.total, 0);
    const paid = chargePreview.reduce((s, l) => s + l.paidN, 0);
    return { receivable: round2(receivable), paid: round2(paid) };
  }, [chargePreview]);

  const duesTotal = round2(outstanding.charges + outstanding.rents);
  const clearsLotWithDues =
    lot !== null && bagsNum > 0 && bagsNum === lot.balance_bags && duesTotal > DUES_EPSILON;

  const dirty = useMemo(() => {
    if (customer !== null) return true;
    if (lot !== null) return true;
    if (bagsStr !== "") return true;
    if (notes.trim() !== "") return true;
    if (driverName.trim() !== "") return true;
    if (vehicleNumber.trim() !== "") return true;
    return false;
  }, [customer, lot, bagsStr, notes, driverName, vehicleNumber]);

  const lotCanLoadMore =
    lotTotalCount !== null ? lotRows.length < lotTotalCount : lotRows.length === PAGE_SIZE;

  async function handleSubmit() {
    if (!warehouseId || !customer || !lot) return;
    const bags = Math.floor(Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10));
    if (!Number.isFinite(bags) || bags <= 0) return;
    if (bags > lot.balance_bags) return;
    if (chargeDefs.length === 0) return;

    const lines = chargePreview.map((l) => ({
      productChargeTypeId: l.productChargeTypeId,
      chargesPerBag: l.chargesPerBag,
      numBags: l.lineNumBags,
      paidNow: l.paidN,
    }));

    if (lines.some((l) => l.paidNow > 0) && !paymentMethod) {
      setErrorOpen({ title: "Payment method", message: "Choose a payment method for amounts paid now." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await insertDeliveryWithCharges(supabase, {
        warehouseId,
        customerId: customer.customer_id,
        lotId: lot.lot_id,
        numBagsOut: bags,
        deliveryDateIso: deliveryDate,
        notes: notes.trim() === "" ? null : notes.trim(),
        driverName: driverName.trim() === "" ? null : driverName.trim(),
        vehicleNumber: vehicleNumber.trim() === "" ? null : vehicleNumber.trim(),
        chargeLines: lines,
        paymentMethod: lines.some((l) => l.paidNow > 0) ? paymentMethod : null,
      });
      const syn = buildSyntheticDeliveryRow({
        deliveryId: result.deliveryId,
        lotId: result.lotId,
        lotNumber: result.lotNumber,
        deliveryDateIso: deliveryDate,
        numBagsOut: bags,
        balanceBagsAfter: result.balanceBagsAfter,
        lotStatus: result.lotStatus,
        customerCode: result.customerCode,
        customerName: result.customerName,
        productName: result.productName,
      });
      DeviceEventEmitter.emit(STOCK_REFRESH_EVENT, syn);
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save delivery.";
      setErrorOpen({ title: "Could not save", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const bottomPad = Math.max(insets.bottom, 12);

  if (!warehouseId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.centerMsg}>Select a warehouse first.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            if (dirty) setDiscardOpen(true);
            else onClose();
          }}
          style={styles.headerBtn}
        >
          <ChevronLeft size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Add Delivery
          </Text>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 96 }]}
      >
        <Text style={styles.label}>Party</Text>
        <Pressable style={styles.selectBtn} onPress={() => setCustModal(true)}>
          <Text style={customer ? styles.selectText : styles.selectPlaceholder}>
            {customer ? `${customer.customer_name} (${customer.customer_code})` : "Search parties…"}
          </Text>
        </Pressable>

        <Text style={styles.label}>Lot</Text>
        <Pressable
          style={[styles.selectBtn, !customer && styles.selectBtnDisabled]}
          disabled={!customer}
          onPress={() => customer && setLotModal(true)}
        >
          <Text style={lot ? styles.selectText : styles.selectPlaceholder}>
            {!customer ? "Choose party first" : lot ? `${lot.lot_number} · ${lot.balance_bags.toLocaleString("en-IN")} bags left` : "Search lots…"}
          </Text>
        </Pressable>

        <Text style={styles.label}>Num bags</Text>
        <TextInput
          value={bagsStr}
          onChangeText={(t) => setBagsStr(t.replace(/\D/g, ""))}
          style={styles.input}
          placeholder="Bags in this dispatch"
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="number-pad"
        />
        {lot && bagsNum > lot.balance_bags ?
          <Text style={styles.errorHint}>
            Cannot exceed {lot.balance_bags.toLocaleString("en-IN")} bags on this lot.
          </Text>
        : null}

        <Text style={styles.label}>Delivery date</Text>
        <MobileDatePickerField value={deliveryDate} onChange={setDeliveryDate} />

        {lot ?
          <View style={styles.warningCard}>
            <Text style={styles.sectionKicker}>Lot dues (read only)</Text>
            {outstandingLoading ?
              <ActivityIndicator style={{ marginTop: 8 }} color={tokens.brandUi} />
            : (
              <>
                <View style={styles.duesRow}>
                  <Text style={styles.duesLabel}>Charges due (lodgement and past dispatches)</Text>
                  <Text style={styles.duesValue}>{formatIndianCurrency2(outstanding.charges)}</Text>
                </View>
                <View style={styles.duesRow}>
                  <Text style={styles.duesLabel}>Rent accrued due</Text>
                  <Text style={styles.duesValue}>{formatIndianCurrency2(outstanding.rents)}</Text>
                </View>
              </>
            )}
            {clearsLotWithDues ?
              <Text style={styles.warningBold}>
                This last Delivery will clear the lot while the customer has outstanding dues.
              </Text>
            : null}
          </View>
        : null}

        <Pressable
          style={styles.sectionHeaderBtn}
          onPress={() => {
            void Haptics.selectionAsync();
            setTransportOpen((v) => !v);
          }}
        >
          <Text style={styles.sectionKicker}>Transport details</Text>
          <ChevronDown
            size={20}
            color={tokens.textTertiary}
            strokeWidth={STROKE}
            style={transportOpen ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </Pressable>
        {transportOpen ?
          <View style={styles.transportGrid}>
            <View style={styles.transportCol}>
              <Text style={styles.label}>Driver (optional)</Text>
              <TextInput
                value={driverName}
                onChangeText={setDriverName}
                style={styles.input}
                placeholderTextColor={tokens.textPlaceholder}
              />
            </View>
            <View style={styles.transportCol}>
              <Text style={styles.label}>Vehicle (optional)</Text>
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                style={styles.input}
                placeholderTextColor={tokens.textPlaceholder}
              />
            </View>
          </View>
        : null}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
          placeholderTextColor={tokens.textPlaceholder}
        />

        {lot ?
          <View style={styles.chargeCard}>
            <Pressable
              style={styles.sectionHeaderBtnFlat}
              onPress={() => {
                void Haptics.selectionAsync();
                setChargesOpen((v) => !v);
              }}
            >
              <Text style={styles.chargeTitle}>Charges</Text>
              <ChevronDown
                size={20}
                color={tokens.textTertiary}
                strokeWidth={STROKE}
                style={chargesOpen ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            </Pressable>
            {chargesOpen ?
              loadingCharges ?
                <ActivityIndicator color={tokens.brandUi} />
              : chargeDefs.length === 0 ?
                <Text style={styles.muted}>No charge lines for this commodity.</Text>
              : (
                <>
                  {chargePreview.map((l) => {
                    const locked = isChargeNumBagsLockedToLot(l.code);
                    const nbVal = numBagsByLine[l.productChargeTypeId] ?? "0";
                    return (
                      <View key={l.productChargeTypeId} style={styles.chargeItemCard}>
                        <Text style={styles.chargeTitleLine}>
                          {l.displayName}
                          <Text style={styles.chargeTitleRate}>
                            {" "}
                            ({formatIndianCurrency2(l.chargesPerBag)} / bag)
                          </Text>
                        </Text>
                        <View style={styles.chargeMidRow}>
                          <View style={styles.chargeBagsCol}>
                            <Text style={styles.chargeFieldLabel}>Bags</Text>
                            <TextInput
                              value={nbVal}
                              editable={!locked}
                              onChangeText={(t) =>
                                setNumBagsByLine((prev) => ({
                                  ...prev,
                                  [l.productChargeTypeId]: t.replace(/\D/g, ""),
                                }))
                              }
                              style={[styles.input, styles.chargeBagsInput, locked && styles.inputDisabled]}
                              keyboardType="number-pad"
                              placeholderTextColor={tokens.textPlaceholder}
                            />
                          </View>
                          <View style={[styles.chargeAmtCompact, styles.chargeReceivableCol]}>
                            <Text style={[styles.chargeFieldLabel, { textAlign: "right" }]}>Amount receivable</Text>
                            <Text style={styles.receivableAmountBold}>{formatIndianCurrency2(l.total)}</Text>
                          </View>
                        </View>
                        <AmountField
                          label="Amount paid"
                          optionalSuffix="(optional)"
                          dense
                          valueAlign="right"
                          twoDecimalBlur
                          containerStyle={styles.chargeAmtCompact}
                          value={paidNowStr[l.productChargeTypeId] ?? ""}
                          onChange={(v) =>
                            setPaidNowStr((prev) => ({ ...prev, [l.productChargeTypeId]: formatRupeeInputLive(v) }))
                          }
                        />
                      </View>
                    );
                  })}
                  <View style={styles.chargeSummary}>
                    <View style={styles.chargeSummaryRow}>
                      <Text style={styles.chargeSummaryLabel}>Total charges receivable</Text>
                      <Text style={styles.chargeSummaryValue}>{formatIndianCurrency2(chargeTotals.receivable)}</Text>
                    </View>
                    <View style={styles.chargeSummaryRow}>
                      <Text style={styles.chargeSummaryTotalLabel}>Total charges paid</Text>
                      <Text style={styles.chargeSummaryTotalValue}>{formatIndianCurrency2(chargeTotals.paid)}</Text>
                    </View>
                  </View>
                </>
              )
            : null}
          </View>
        : null}

        {anyPayNow ?
          <>
            <Text style={styles.label}>Payment method for pay now</Text>
            <View style={styles.pmWrap}>
              {PAYMENT_METHOD_VALUES.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.pmChip, paymentMethod === m && styles.pmChipOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setPaymentMethod(m);
                  }}
                >
                  <Text style={[styles.pmChipText, paymentMethod === m && styles.pmChipTextOn]}>
                    {paymentMethodLabel(m)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            if (dirty) setDiscardOpen(true);
            else onClose();
          }}
          style={[styles.footerBtn, styles.footerBtnSecondary]}
        >
          <Text style={styles.footerBtnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={
            submitting ||
            !customer ||
            !lot ||
            chargeDefs.length === 0 ||
            (lot !== null && bagsNum > lot.balance_bags)
          }
          onPress={() => void handleSubmit()}
          style={[
            styles.footerBtn,
            styles.footerBtnPrimary,
            (submitting ||
              !customer ||
              !lot ||
              chargeDefs.length === 0 ||
              (lot !== null && bagsNum > lot.balance_bags)) &&
              styles.footerBtnDisabled,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>{submitting ? "Creating…" : "Create Delivery"}</Text>
        </Pressable>
      </View>

      <Modal visible={custModal} animationType="slide" onRequestClose={() => setCustModal(false)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose party</Text>
            <Pressable onPress={() => setCustModal(false)} hitSlop={12} accessibilityRole="button">
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={custQ}
              onChangeText={setCustQ}
              placeholder="Search…"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
            />
          </View>
          {custLoading && custRows.length === 0 ?
            <ActivityIndicator style={{ marginTop: 24 }} color={tokens.brandUi} />
          : (
            <FlatList
              data={custRows}
              keyExtractor={(item) => item.customer_id}
              onEndReached={() => {
                if (!custLoading) void fetchCust(custRows.length, false);
              }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listRow}
                  onPress={() => {
                    setCustomer(item);
                    setLot(null);
                    setCustModal(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{partyInitials(item.customer_name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.customer_name}
                    </Text>
                    <Text style={styles.listCode} numberOfLines={1}>
                      {item.customer_code}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>

      <Modal visible={lotModal} animationType="slide" onRequestClose={() => setLotModal(false)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose lot</Text>
            <Pressable onPress={() => setLotModal(false)} hitSlop={12} accessibilityRole="button">
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={lotQ}
              onChangeText={setLotQ}
              placeholder="Search lot number…"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
            />
          </View>
          {!customer ?
            <Text style={[styles.muted, { padding: tokens.sp4 }]}>Choose a party first.</Text>
          : lotLoading && lotRows.length === 0 ?
            <ActivityIndicator style={{ marginTop: 24 }} color={tokens.brandUi} />
          : (
            <FlatList
              data={lotRows}
              keyExtractor={(item) => item.lot_id}
              onEndReached={() => {
                if (!lotLoading && lotCanLoadMore) void fetchLots(lotRows.length, false);
              }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listRow}
                  onPress={() => {
                    setLot(item);
                    setLotModal(false);
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.lot_number}
                    </Text>
                    <Text style={styles.listCode} numberOfLines={2}>
                      {item.product_name} · {item.balance_bags.toLocaleString("en-IN")} bags left
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>

      <BrandedAlertModal
        visible={discardOpen}
        title="Discard changes?"
        message="You have unsaved details for this dispatch."
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
        visible={errorOpen !== null}
        title={errorOpen?.title ?? ""}
        message={errorOpen?.message}
        onConfirm={() => setErrorOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
  centerMsg: { padding: 24, fontSize: 15, color: tokens.textSecondary, fontFamily: "NotoSans-Regular" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    paddingHorizontal: 4,
  },
  headerBtn: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    justifyContent: "flex-start",
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
  },
  scrollContent: { paddingHorizontal: tokens.sp4, paddingTop: tokens.sp3, gap: 6 },
  sectionHeaderBtn: {
    marginTop: tokens.sp3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  sectionHeaderBtnFlat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.sp2,
  },
  sectionKicker: {
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  transportGrid: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  transportCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    marginTop: tokens.sp2,
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  selectBtn: {
    marginTop: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: tokens.bgSubtle,
  },
  selectBtnDisabled: { opacity: 0.6 },
  selectText: { fontSize: 16, fontFamily: "NotoSans-Regular", color: tokens.textPrimary },
  selectPlaceholder: { fontSize: 16, fontFamily: "NotoSans-Regular", color: tokens.textPlaceholder },
  input: {
    marginTop: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSubtle,
  },
  errorHint: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.outward,
  },
  warningCard: {
    marginTop: tokens.sp2,
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
    gap: 8,
  },
  duesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  duesLabel: { flex: 1, fontSize: 14, fontFamily: "NotoSans-Regular", color: tokens.textSecondary },
  duesValue: {
    fontSize: 14,
    fontFamily: "NotoSansMono-Regular",
    color: tokens.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  warningBold: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "NotoSans-Medium",
    color: tokens.brandText,
  },
  chargeCard: {
    marginTop: tokens.sp3,
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    gap: tokens.sp2,
  },
  chargeTitle: {
    fontFamily: "NotoSans-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  muted: { fontFamily: "NotoSans-Regular", fontSize: 14, color: tokens.textSecondary },
  chargeItemCard: {
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    gap: tokens.sp2,
  },
  chargeTitleLine: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 14,
    color: tokens.textPrimary,
    flexWrap: "wrap",
  },
  chargeTitleRate: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: tokens.textSecondary,
    fontWeight: "400",
  },
  chargeMidRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  chargeBagsCol: { flexShrink: 0, minWidth: 100 },
  chargeBagsInput: { maxWidth: 120, textAlign: "right" as const },
  chargeFieldLabel: {
    marginTop: 0,
    marginBottom: 4,
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  chargeReceivableCol: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  chargeAmtCompact: { maxWidth: 220, width: "100%", alignSelf: "flex-start" },
  receivableAmountBold: {
    marginTop: 6,
    fontFamily: "NotoSans-SemiBold",
    fontSize: 16,
    color: tokens.textPrimary,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  inputDisabled: { opacity: 0.72 },
  chargeSummary: {
    marginTop: tokens.sp3,
    paddingTop: tokens.sp3,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    gap: 8,
  },
  chargeSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  chargeSummaryLabel: {
    flex: 1,
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  chargeSummaryValue: {
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    color: tokens.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  chargeSummaryTotalLabel: {
    flex: 1,
    fontFamily: "NotoSans-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  chargeSummaryTotalValue: {
    fontFamily: "NotoSans-SemiBold",
    fontSize: 15,
    color: tokens.textPrimary,
    fontVariant: ["tabular-nums"],
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
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: tokens.sp4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  footerBtn: { flex: 1, minHeight: 48, borderRadius: tokens.radiusMd, alignItems: "center", justifyContent: "center" },
  footerBtnSecondary: { borderWidth: 1, borderColor: tokens.borderDefault, backgroundColor: tokens.bgSubtle },
  footerBtnSecondaryText: { fontFamily: "NotoSans-SemiBold", fontSize: 16, color: tokens.textPrimary },
  footerBtnPrimary: { backgroundColor: tokens.brandUi },
  footerBtnPrimaryText: { fontFamily: "NotoSans-SemiBold", fontSize: 16, color: tokens.textOnBrand },
  footerBtnDisabled: { opacity: 0.5 },
  modalRoot: { flex: 1, backgroundColor: tokens.bgPage },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.sp3,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  modalTitle: { fontFamily: "NotoSerif-SemiBold", fontSize: 18, color: tokens.textPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: tokens.sp3,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: "NotoSans-Regular", color: tokens.textPrimary, minHeight: 44 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: tokens.sp4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.brandSubtle,
  },
  avatarText: { fontFamily: "NotoSans-SemiBold", fontSize: 13, color: tokens.brandText },
  listTitle: { fontFamily: "NotoSerif-SemiBold", fontSize: 15, color: tokens.textPrimary },
  listCode: { fontFamily: "NotoSans-Regular", fontSize: 13, color: tokens.textSecondary },
});
