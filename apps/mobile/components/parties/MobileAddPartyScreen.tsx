import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  fetchDistinctPartyCodesForWarehouse,
  findActiveCustomerCodeOwningPrimaryPhone,
  insertCustomer,
  PARTIES_REFRESH_EVENT,
  type PartyCodePickRow,
  warehouseHasActiveCustomerCode,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { buildPlaceholderPartyListRow } from "@stockright/shared/parties-tab";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { MobilePartyPhoneField } from "./MobilePartyPhoneField";

const STROKE = 2;

interface MobileAddPartyScreenProps {
  warehouseId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function MobileAddPartyScreen({ warehouseId: warehouseIdProp, onClose, onDone }: MobileAddPartyScreenProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const insets = useSafeAreaInsets();
  const [warehouseId, setWarehouseId] = useState<string | null>(warehouseIdProp ?? null);
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [address, setAddress] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [phoneConflictHint, setPhoneConflictHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState<{ title: string; message: string } | null>(null);
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const debouncedCodeSearch = useDebouncedValue(codeSearch.trim(), 320);
  const [codeRows, setCodeRows] = useState<PartyCodePickRow[]>([]);
  const [codeLoading, setCodeLoading] = useState(false);
  const initialRef = useRef({
    customerName: "",
    customerCode: "",
    phone: "",
    alternateMobile: "",
    address: "",
    phoneLocked: false,
  });

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

  useEffect(() => {
    if (!codePickerOpen || !warehouseId) return;
    let cancelled = false;
    setCodeLoading(true);
    void fetchDistinctPartyCodesForWarehouse(supabase, {
      warehouseId,
      q: debouncedCodeSearch,
      limit: 120,
    })
      .then((rows) => {
        if (!cancelled) setCodeRows(rows);
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codePickerOpen, debouncedCodeSearch, supabase, warehouseId]);

  useEffect(() => {
    if (!codePickerOpen) setCodeSearch("");
  }, [codePickerOpen]);

  const debouncedCode = useDebouncedValue(customerCode.trim(), 320);
  const debouncedPhone = useDebouncedValue(phone.trim(), 320);

  useEffect(() => {
    let cancelled = false;
    async function run(): Promise<void> {
      if (!warehouseId || !debouncedCode || !debouncedPhone || phoneLocked) {
        setPhoneConflictHint(null);
        return;
      }
      try {
        const exists = await warehouseHasActiveCustomerCode(supabase, {
          warehouseId,
          customerCode: debouncedCode,
        });
        if (cancelled) return;
        if (exists) {
          setPhoneConflictHint(null);
          return;
        }
        const other = await findActiveCustomerCodeOwningPrimaryPhone(supabase, {
          warehouseId,
          phoneRaw: debouncedPhone,
          excludeCustomerCode: debouncedCode,
        });
        if (cancelled) return;
        if (other) {
          setPhoneConflictHint(`Phone number is already set up for ${other}.`);
        } else {
          setPhoneConflictHint(null);
        }
      } catch {
        if (!cancelled) setPhoneConflictHint(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedCode, debouncedPhone, phoneLocked, supabase, warehouseId]);

  const dirty = useMemo(() => {
    if (customerName.trim() !== initialRef.current.customerName) return true;
    if (customerCode.trim() !== initialRef.current.customerCode) return true;
    if (phone.trim() !== initialRef.current.phone) return true;
    if (alternateMobile.trim() !== initialRef.current.alternateMobile) return true;
    if (address.trim() !== initialRef.current.address) return true;
    if (phoneLocked !== initialRef.current.phoneLocked) return true;
    return false;
  }, [customerName, customerCode, phone, alternateMobile, address, phoneLocked]);

  function handleCodePick(row: PartyCodePickRow) {
    setCustomerCode(row.customer_code);
    setCodePickerOpen(false);
    void Haptics.selectionAsync();
    if (row.phoneInconsistent) {
      setErrorOpen({
        title: "Cannot use this code",
        message: "This party code has conflicting phone numbers on file. Fix the data first.",
      });
      setPhone("");
      setPhoneLocked(false);
      return;
    }
    if (row.phone) {
      setPhone(row.phone);
      setPhoneLocked(true);
    } else {
      setPhone("");
      setPhoneLocked(false);
    }
  }

  async function handleSubmit() {
    if (!warehouseId) return;
    setSubmitting(true);
    try {
      const name = customerName.trim();
      const code = customerCode.trim();
      const { id } = await insertCustomer(supabase, {
        warehouseId,
        customerName: name,
        customerCode: code,
        phone,
        alternateMobile,
        address,
      });
      const row = buildPlaceholderPartyListRow({
        customerId: id,
        customerCode: code,
        customerName: name,
        address: address.trim(),
      });
      DeviceEventEmitter.emit(PARTIES_REFRESH_EVENT, row);
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save party.";
      setErrorOpen({ title: "Could not save", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const labelStyle = styles.label;
  const inputStyle = styles.input;

  const bottomPadByLayout = Math.max(insets.bottom, 12);

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
            if (dirty) {
              setDiscardOpen(true);
              return;
            }
            onClose();
          }}
          style={styles.headerBtn}
        >
          <ChevronLeft size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add Party
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadByLayout + 96 }]}
      >
        <Text style={labelStyle}>Party code</Text>
        <View style={styles.codeRow}>
          <TextInput
            value={customerCode}
            onChangeText={(t) => {
              setCustomerCode(t);
              setPhoneLocked(false);
            }}
            style={[inputStyle, styles.codeInputFlex]}
            placeholder="Short code"
            placeholderTextColor={tokens.textPlaceholder}
            autoCapitalize="characters"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search existing party codes"
            onPress={() => {
              void Haptics.selectionAsync();
              setCodePickerOpen(true);
            }}
            style={styles.codeChevronBtn}
          >
            <ChevronDown size={22} color={tokens.textTertiary} strokeWidth={STROKE} />
          </Pressable>
        </View>

        <MobilePartyPhoneField
          label="Phone number"
          value={phone}
          onChange={setPhone}
          disabled={phoneLocked}
        />
        {phoneConflictHint ? (
          <Text style={styles.phoneConflictHint}>{phoneConflictHint}</Text>
        ) : null}

        <Text style={labelStyle}>Party name</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          style={inputStyle}
          placeholder="Name as on records"
          placeholderTextColor={tokens.textPlaceholder}
          autoCapitalize="words"
        />

        <MobilePartyPhoneField label="Alternate number" value={alternateMobile} onChange={setAlternateMobile} />

        <Text style={labelStyle}>Address (optional)</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          style={[inputStyle, { minHeight: 96, textAlignVertical: "top" }]}
          placeholder="Village / location"
          placeholderTextColor={tokens.textPlaceholder}
          multiline
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadByLayout }]}>
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
          disabled={submitting || customerName.trim() === "" || customerCode.trim() === ""}
          onPress={() => void handleSubmit()}
          style={[
            styles.footerBtn,
            styles.footerBtnPrimary,
            (submitting || customerName.trim() === "" || customerCode.trim() === "") && styles.footerBtnDisabled,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>{submitting ? "Saving…" : "Save party"}</Text>
        </Pressable>
      </View>

      <Modal
        visible={codePickerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCodePickerOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setCodePickerOpen(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={22} color={tokens.textPrimary} strokeWidth={STROKE} />
            </Pressable>
            <Text style={styles.modalTitle}>Choose party code</Text>
            <View style={styles.modalHeaderBtn} />
          </View>
          <View style={styles.modalSearchWrap}>
            <Search size={18} color={tokens.textTertiary} strokeWidth={STROKE} />
            <TextInput
              value={codeSearch}
              onChangeText={setCodeSearch}
              placeholder="Search code…"
              placeholderTextColor={tokens.textPlaceholder}
              style={styles.modalSearchInput}
              autoFocus
            />
          </View>
          {codeLoading && codeRows.length === 0 ? (
            <Text style={styles.modalEmpty}>Loading…</Text>
          ) : null}
          {!codeLoading && codeRows.length === 0 ? (
            <Text style={styles.modalEmpty}>No codes found. Type a new code on the form.</Text>
          ) : null}
          <FlatList
            data={codeRows}
            keyExtractor={(item) => item.customer_code}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleCodePick(item)}
                style={styles.codeListRow}
              >
                <Text style={styles.codeListCode}>{item.customer_code}</Text>
                {item.phoneInconsistent ? (
                  <Text style={styles.codeListWarn}>Conflicting numbers on file</Text>
                ) : item.phone ? (
                  <Text style={styles.codeListMeta}>{item.phone}</Text>
                ) : (
                  <Text style={styles.codeListMetaMuted}>No primary phone on file</Text>
                )}
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
  scrollContent: { paddingHorizontal: tokens.sp4, paddingTop: tokens.sp3, gap: 8 },
  label: {
    marginTop: tokens.sp2,
    fontFamily: "NotoSans-Medium",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.textTertiary,
  },
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
  codeRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeInputFlex: { flex: 1, marginTop: 0 },
  codeChevronBtn: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneConflictHint: {
    marginTop: 6,
    fontSize: 12,
    color: tokens.outward,
    fontFamily: "NotoSans-Regular",
  },
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
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    paddingHorizontal: 4,
  },
  modalHeaderBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  modalTitle: {
    flex: 1,
    fontFamily: "NotoSerif-SemiBold",
    fontSize: 18,
    color: tokens.textPrimary,
    textAlign: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: tokens.sp4,
    marginTop: tokens.sp3,
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgSubtle,
  },
  modalSearchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
  },
  modalEmpty: {
    paddingHorizontal: tokens.sp4,
    paddingVertical: 16,
    fontSize: 14,
    color: tokens.textTertiary,
    fontFamily: "NotoSans-Regular",
  },
  codeListRow: {
    paddingHorizontal: tokens.sp4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    minHeight: 56,
  },
  codeListCode: {
    fontFamily: "NotoSans-Regular",
    fontSize: 15,
    fontWeight: "600",
    color: tokens.textPrimary,
  },
  codeListMeta: { marginTop: 4, fontSize: 13, color: tokens.textSecondary, fontFamily: "NotoSans-Regular" },
  codeListMetaMuted: { marginTop: 4, fontSize: 13, color: tokens.textTertiary, fontFamily: "NotoSans-Regular" },
  codeListWarn: { marginTop: 4, fontSize: 13, color: tokens.outward, fontFamily: "NotoSans-Regular" },
});
