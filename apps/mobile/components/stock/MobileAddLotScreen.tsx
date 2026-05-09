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
  fetchProductChargesForProduct,
  insertLodgementLot,
  previewNextLotNumber,
  searchCustomersQuickPick,
  searchProductsQuickPick,
  STOCK_REFRESH_EVENT,
  type PartiesTabRow,
  type ProductPickRow,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import {
  formatRupeeInputLive,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { buildSyntheticLodgementRow } from "@stockright/shared/stock-tab";
import { formatIndianCurrency, partyInitials, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
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

function mergeProd(a: ProductPickRow[], b: ProductPickRow[]): ProductPickRow[] {
  const seen = new Set(a.map((r) => r.product_id));
  const out = [...a];
  for (const row of b) {
    if (!seen.has(row.product_id)) {
      seen.add(row.product_id);
      out.push(row);
    }
  }
  return out;
}

function initialNumBagsMap(rows: ChargeDef[], lodgedBags: number): Record<string, string> {
  const o: Record<string, string> = {};
  for (const row of rows) {
    o[row.productChargeTypeId] = row.code === "PLATFORM_HAMALI" ? String(Math.max(0, lodgedBags)) : "0";
  }
  return o;
}

interface MobileAddLotScreenProps {
  warehouseId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function MobileAddLotScreen({ warehouseId: warehouseIdProp, onClose, onDone }: MobileAddLotScreenProps) {
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
  const [product, setProduct] = useState<ProductPickRow | null>(null);
  const [custModal, setCustModal] = useState(false);
  const [prodModal, setProdModal] = useState(false);
  const [custQ, setCustQ] = useState("");
  const [prodQ, setProdQ] = useState("");
  const debCustQ = useDebouncedValue(custQ.trim(), 320);
  const debProdQ = useDebouncedValue(prodQ.trim(), 320);
  const [custRows, setCustRows] = useState<PartiesTabRow[]>([]);
  const [prodRows, setProdRows] = useState<ProductPickRow[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);
  const [bagsStr, setBagsStr] = useState("");
  const [lodgementDate, setLodgementDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [chargeDefs, setChargeDefs] = useState<ChargeDef[]>([]);
  const [numBagsByLine, setNumBagsByLine] = useState<Record<string, string>>({});
  const [paidNowStr, setPaidNowStr] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [transportOpen, setTransportOpen] = useState(false);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [lotPreview, setLotPreview] = useState<string | null>(null);
  const [lotPreviewLoading, setLotPreviewLoading] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState<{ title: string; message: string } | null>(null);

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

  const fetchProd = useCallback(
    async (offset: number, reset: boolean) => {
      if (!warehouseId) return;
      setProdLoading(true);
      try {
        const { rows } = await searchProductsQuickPick(supabase, {
          warehouseId,
          q: debProdQ,
          limit: PAGE_SIZE,
          offset,
        });
        setProdRows((prev) => (reset ? rows : mergeProd(prev, rows)));
      } finally {
        setProdLoading(false);
      }
    },
    [debProdQ, supabase, warehouseId]
  );

  useEffect(() => {
    if (!custModal) return;
    setCustRows([]);
    void fetchCust(0, true);
  }, [custModal, debCustQ, fetchCust]);

  useEffect(() => {
    if (!prodModal) return;
    setProdRows([]);
    void fetchProd(0, true);
  }, [prodModal, debProdQ, fetchProd]);

  useEffect(() => {
    if (!product) {
      setChargeDefs([]);
      setNumBagsByLine({});
      setPaidNowStr({});
      return;
    }
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchProductChargesForProduct(supabase, product.product_id);
        if (!cancelled) {
          setChargeDefs(rows);
          setPaidNowStr({});
          const lodged = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
          setNumBagsByLine(initialNumBagsMap(rows, Number.isFinite(lodged) ? lodged : 0));
        }
      } finally {
        if (!cancelled) setLoadingCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product, supabase]);

  const bagsNum = useMemo(() => {
    const n = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [bagsStr]);

  useEffect(() => {
    setNumBagsByLine((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const l of chargeDefs) {
        if (l.code === "PLATFORM_HAMALI") {
          const v = String(bagsNum);
          if (next[l.productChargeTypeId] !== v) {
            next[l.productChargeTypeId] = v;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [bagsNum, chargeDefs]);

  useEffect(() => {
    if (bagsNum <= 0 || !warehouseId) {
      setLotPreview(null);
      setLotPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setLotPreviewLoading(true);
    void previewNextLotNumber(supabase, warehouseId, bagsNum)
      .then((s) => {
        if (!cancelled) setLotPreview(s);
      })
      .catch(() => {
        if (!cancelled) setLotPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLotPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bagsNum, warehouseId, supabase]);

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

  const dirty = useMemo(() => {
    if (customer !== null) return true;
    if (product !== null) return true;
    if (bagsStr !== "") return true;
    if (notes.trim() !== "") return true;
    if (driverName.trim() !== "") return true;
    if (vehicleNumber.trim() !== "") return true;
    return false;
  }, [customer, product, bagsStr, notes, driverName, vehicleNumber]);

  async function handleSubmit() {
    if (!warehouseId || !customer || !product) return;
    const bags = Math.floor(Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10));
    if (!Number.isFinite(bags) || bags <= 0) return;
    if (chargeDefs.length === 0) return;

    const lines = chargePreview.map((l) => ({
      productChargeTypeId: l.productChargeTypeId,
      chargesPerBag: l.chargesPerBag,
      numBags: l.lineNumBags,
      paidNow: l.paidN,
    }));

    setSubmitting(true);
    try {
      const { lotId, lotNumber } = await insertLodgementLot(supabase, {
        warehouseId,
        customerId: customer.customer_id,
        productId: product.product_id,
        numBags: bags,
        lodgementDateIso: lodgementDate,
        notes: notes.trim() === "" ? null : notes.trim(),
        driverName: driverName.trim() === "" ? null : driverName.trim(),
        vehicleNumber: vehicleNumber.trim() === "" ? null : vehicleNumber.trim(),
        chargeLines: lines,
        paymentMethod: lines.some((l) => l.paidNow > 0) ? paymentMethod : null,
      });
      const syn = buildSyntheticLodgementRow({
        lotId,
        lotNumber,
        lodgementDateIso: lodgementDate,
        numBags: bags,
        customerCode: customer.customer_code,
        customerName: customer.customer_name,
        productName: product.product_name,
      });
      DeviceEventEmitter.emit(STOCK_REFRESH_EVENT, syn);
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save lot.";
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add Lot
        </Text>
        <View style={styles.headerSpacer} />
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

        <Text style={styles.label}>Commodity</Text>
        <Pressable style={styles.selectBtn} onPress={() => setProdModal(true)}>
          <Text style={product ? styles.selectText : styles.selectPlaceholder}>
            {product ? product.product_name : "Search commodities…"}
          </Text>
        </Pressable>

        <Text style={styles.label}>Bags</Text>
        <TextInput
          value={bagsStr}
          onChangeText={(t) => setBagsStr(t.replace(/\D/g, ""))}
          style={styles.input}
          placeholder="Number of bags"
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="number-pad"
        />

        {bagsNum > 0 ?
          <View style={styles.lotPreviewBox}>
            <Text style={styles.sectionKicker}>Lot number (preview)</Text>
            <Text style={styles.lotPreviewText}>
              {lotPreviewLoading ? "Resolving…" : (lotPreview ?? "—")}
            </Text>
          </View>
        : null}

        <Text style={styles.label}>Receive date</Text>
        <MobileDatePickerField value={lodgementDate} onChange={setLodgementDate} />

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
          <>
            <Text style={styles.label}>Driver (optional)</Text>
            <TextInput
              value={driverName}
              onChangeText={setDriverName}
              style={styles.input}
              placeholderTextColor={tokens.textPlaceholder}
            />
            <Text style={styles.label}>Vehicle (optional)</Text>
            <TextInput
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              style={styles.input}
              placeholderTextColor={tokens.textPlaceholder}
            />
          </>
        : null}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
          multiline
          placeholderTextColor={tokens.textPlaceholder}
        />

        {product ?
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
                chargePreview.map((l) => (
                  <View key={l.productChargeTypeId} style={styles.chargeRow}>
                    <Text style={styles.chargeName}>{l.displayName}</Text>
                    <Text style={styles.rateLine}>{formatIndianCurrency(l.chargesPerBag)} / bag</Text>
                    <Text style={styles.bagFieldLabel}>Bags for this charge</Text>
                    <TextInput
                      value={numBagsByLine[l.productChargeTypeId] ?? "0"}
                      onChangeText={(t) =>
                        setNumBagsByLine((prev) => ({
                          ...prev,
                          [l.productChargeTypeId]: t.replace(/\D/g, ""),
                        }))
                      }
                      style={styles.input}
                      keyboardType="number-pad"
                      placeholderTextColor={tokens.textPlaceholder}
                    />
                    <Text style={styles.receivableLine}>Receivable {formatIndianCurrency(l.total)}</Text>
                    <AmountField
                      label="Pay now"
                      optionalSuffix="(optional)"
                      value={paidNowStr[l.productChargeTypeId] ?? ""}
                      onChange={(v) =>
                        setPaidNowStr((prev) => ({ ...prev, [l.productChargeTypeId]: formatRupeeInputLive(v) }))
                      }
                    />
                  </View>
                ))
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
          disabled={submitting || !customer || !product || chargeDefs.length === 0}
          onPress={() => void handleSubmit()}
          style={[
            styles.footerBtn,
            styles.footerBtnPrimary,
            (submitting || !customer || !product || chargeDefs.length === 0) && styles.footerBtnDisabled,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>{submitting ? "Saving…" : "Save lot"}</Text>
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

      <Modal visible={prodModal} animationType="slide" onRequestClose={() => setProdModal(false)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose commodity</Text>
            <Pressable onPress={() => setProdModal(false)} hitSlop={12} accessibilityRole="button">
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={prodQ}
              onChangeText={setProdQ}
              placeholder="Search…"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.searchInput}
            />
          </View>
          {prodLoading && prodRows.length === 0 ?
            <ActivityIndicator style={{ marginTop: 24 }} color={tokens.brandUi} />
          : (
            <FlatList
              data={prodRows}
              keyExtractor={(item) => item.product_id}
              onEndReached={() => {
                if (!prodLoading) void fetchProd(prodRows.length, false);
              }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listRow}
                  onPress={() => {
                    setProduct(item);
                    setProdModal(false);
                  }}
                >
                  <Text style={styles.listTitle}>{item.product_name}</Text>
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
  headerSpacer: { width: 48 },
  headerTitle: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
    textAlign: "center",
  },
  scrollContent: { paddingHorizontal: tokens.sp4, paddingTop: tokens.sp3, gap: 6 },
  lotPreviewBox: {
    marginTop: tokens.sp2,
    padding: tokens.sp3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
  },
  lotPreviewText: { marginTop: 4, fontFamily: "NotoSans-Medium", fontSize: 16, color: tokens.textPrimary },
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
  rateLine: { fontFamily: "NotoSans-Regular", fontSize: 13, color: tokens.textSecondary, marginBottom: 4 },
  bagFieldLabel: {
    marginTop: 8,
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
  receivableLine: {
    marginTop: 8,
    fontFamily: "NotoSans-SemiBold",
    fontSize: 14,
    color: tokens.textPrimary,
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
  chargeRow: { gap: 8, borderBottomWidth: 1, borderBottomColor: tokens.borderDefault, paddingBottom: 14 },
  chargeName: { fontFamily: "NotoSans-SemiBold", fontSize: 14, color: tokens.textPrimary },
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
