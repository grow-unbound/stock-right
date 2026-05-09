import { useEffect, useMemo, useRef, useState } from "react";
import {
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { insertCustomer, PARTIES_REFRESH_EVENT } from "@stockright/shared/api";
import { buildPlaceholderPartyListRow } from "@stockright/shared/parties-tab";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

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
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState<{ title: string; message: string } | null>(null);
  const initialRef = useRef({ customerName: "", customerCode: "", phone: "", alternateMobile: "", address: "" });

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

  const dirty = useMemo(() => {
    if (customerName.trim() !== initialRef.current.customerName) return true;
    if (customerCode.trim() !== initialRef.current.customerCode) return true;
    if (phone.trim() !== initialRef.current.phone) return true;
    if (alternateMobile.trim() !== initialRef.current.alternateMobile) return true;
    if (address.trim() !== initialRef.current.address) return true;
    return false;
  }, [customerName, customerCode, phone, alternateMobile, address]);

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 96 }]}
      >
        <Text style={labelStyle}>Party name</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          style={inputStyle}
          placeholder="Name as on records"
          placeholderTextColor={tokens.textPlaceholder}
          autoCapitalize="words"
        />

        <Text style={labelStyle}>Party code</Text>
        <TextInput
          value={customerCode}
          onChangeText={setCustomerCode}
          style={inputStyle}
          placeholder="Short code"
          placeholderTextColor={tokens.textPlaceholder}
          autoCapitalize="characters"
        />

        <Text style={labelStyle}>Phone (optional)</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={inputStyle}
          placeholder="10-digit mobile"
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="phone-pad"
        />

        <Text style={labelStyle}>Alternate mobile (optional)</Text>
        <TextInput
          value={alternateMobile}
          onChangeText={setAlternateMobile}
          style={inputStyle}
          placeholder="Second number"
          placeholderTextColor={tokens.textPlaceholder}
          keyboardType="phone-pad"
        />

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
});
