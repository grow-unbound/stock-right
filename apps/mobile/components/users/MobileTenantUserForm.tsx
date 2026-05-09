import { useMemo, useState } from "react";
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
import type { TenantUserRow } from "@stockright/shared/api";
import {
  createTenantUser,
  TENANT_USERS_REFRESH_EVENT,
  updateTenantUser,
} from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import {
  createTenantUserInputSchema,
  roleLabel,
  updateTenantUserInputSchema,
} from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";

interface MobileTenantUserFormProps {
  mode: "create" | "edit";
  tenantId: string;
  warehouses: Warehouse[];
  initial?: TenantUserRow;
  onClose: () => void;
}

export function MobileTenantUserForm({
  mode,
  tenantId,
  warehouses,
  initial,
  onClose,
}: MobileTenantUserFormProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;

  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phoneDigits, setPhoneDigits] = useState(() =>
    initial?.phone?.startsWith("+91") ? initial.phone.slice(3) : (initial?.phone ?? "").replace(/\D/g, "")
  );
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<"MANAGER" | "STAFF">(
    initial?.role === "MANAGER" || initial?.role === "STAFF" ? initial.role : "STAFF"
  );
  const [statusActive, setStatusActive] = useState(initial?.isActive ?? true);
  const [selectedWarehouses, setSelectedWarehouses] = useState<Set<string>>(
    () => new Set(initial?.warehouseIds ?? [])
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorOpen, setErrorOpen] = useState<{ title: string; message: string } | null>(null);

  const phone = phoneDigits.replace(/\D/g, "").slice(0, 10);
  const phoneE164 = phone.length === 10 ? `+91${phone}` : "";

  const isOwnerTarget = initial?.role === "OWNER";

  function toggleWh(id: string) {
    void Haptics.selectionAsync();
    setSelectedWarehouses((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleSubmit() {
    const warehouseIds = [...selectedWarehouses];

    if (mode === "create") {
      const parsed = createTenantUserInputSchema.safeParse({
        tenantId,
        fullName: fullName.trim(),
        phone: phoneE164,
        email: email.trim(),
        warehouseIds,
        role,
      });
      if (!parsed.success) {
        setErrorOpen({
          title: "Check fields",
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        });
        return;
      }

      setSubmitting(true);
      try {
        await createTenantUser(supabase, url, parsed.data);
        DeviceEventEmitter.emit(TENANT_USERS_REFRESH_EVENT);
        onClose();
      } catch (e: unknown) {
        setErrorOpen({
          title: "Could not create user",
          message: e instanceof Error ? e.message : "Something went wrong.",
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!initial) return;

    const patch: Record<string, unknown> = {
      tenantId,
      userId: initial.userId,
      fullName: fullName.trim(),
      phone: phoneE164,
      email: email.trim().toLowerCase(),
      isActive: statusActive,
      warehouseIds,
    };
    if (!isOwnerTarget) patch.role = role;

    const parsed = updateTenantUserInputSchema.safeParse(patch);
    if (!parsed.success) {
      setErrorOpen({
        title: "Check fields",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateTenantUser(supabase, url, parsed.data);
      DeviceEventEmitter.emit(TENANT_USERS_REFRESH_EVENT);
      onClose();
    } catch (e: unknown) {
      setErrorOpen({
        title: "Could not save",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={tokens.textPlaceholder}
        />

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phonePrefix}>+91</Text>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={phone}
            onChangeText={(t) => setPhoneDigits(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="number-pad"
            placeholder="9876543210"
            placeholderTextColor={tokens.textPlaceholder}
          />
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          placeholderTextColor={tokens.textPlaceholder}
        />

        {mode === "edit" && isOwnerTarget ? (
          <View style={styles.roleBox}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.roleStatic}>{roleLabel("OWNER")}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {(["MANAGER", "STAFF"] as const).map((r) => (
                <Pressable
                  key={r}
                  accessibilityRole="button"
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setRole(r);
                  }}
                  style={[styles.roleChip, role === r && styles.roleChipOn]}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextOn]}>
                    {roleLabel(r)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {mode === "edit" ? (
          <>
            <Text style={styles.label}>Status</Text>
            <View style={styles.roleRow}>
              <Pressable
                accessibilityRole="button"
                disabled={isOwnerTarget}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStatusActive(true);
                }}
                style={[styles.roleChip, statusActive && styles.roleChipOn]}
              >
                <Text style={[styles.roleChipText, statusActive && styles.roleChipTextOn]}>Active</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isOwnerTarget}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStatusActive(false);
                }}
                style={[styles.roleChip, !statusActive && styles.roleChipOn]}
              >
                <Text style={[styles.roleChipText, !statusActive && styles.roleChipTextOn]}>Inactive</Text>
              </Pressable>
            </View>
            {isOwnerTarget ? (
              <Text style={styles.hint}>Owner status cannot be changed here.</Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Warehouses</Text>
        {warehouses.map((w) => (
          <Pressable
            key={w.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selectedWarehouses.has(w.id) }}
            onPress={() => toggleWh(w.id)}
            style={styles.whRow}
          >
            <View style={[styles.checkbox, selectedWarehouses.has(w.id) && styles.checkboxOn]} />
            <Text style={styles.whName}>{w.warehouseName}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void handleSubmit()}
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? (mode === "create" ? "Adding…" : "Saving…") : mode === "create" ? "Add user" : "Save"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>

      <BrandedAlertModal
        visible={errorOpen !== null}
        title={errorOpen?.title ?? ""}
        message={errorOpen?.message ?? ""}
        confirmLabel="OK"
        onConfirm={() => setErrorOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.textTertiary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: tokens.textPrimary,
    backgroundColor: tokens.bgSurface,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phonePrefix: { fontSize: 16, fontWeight: "600", color: tokens.textSecondary },
  phoneInput: { flex: 1 },
  roleBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSubtle,
  },
  roleStatic: { fontSize: 16, color: tokens.textPrimary, marginTop: 4 },
  roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    minHeight: 48,
    justifyContent: "center",
  },
  roleChipOn: {
    backgroundColor: tokens.brandSubtle,
    borderColor: tokens.brandBorder,
  },
  roleChipText: { fontSize: 15, color: tokens.textSecondary },
  roleChipTextOn: { fontWeight: "600", color: tokens.brandText },
  hint: { fontSize: 12, color: tokens.textTertiary, marginTop: 6 },
  whRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  checkboxOn: {
    backgroundColor: tokens.brandUi,
    borderColor: tokens.brandUi,
  },
  whName: { fontSize: 16, color: tokens.textPrimary, flex: 1 },
  footer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.borderDefault,
    backgroundColor: tokens.bgPage,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: tokens.brandUi,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: "600", color: tokens.textOnBrand },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.bgSurface,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: "600", color: tokens.textPrimary },
});
