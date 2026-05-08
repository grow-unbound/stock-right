import { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { createWarehouse } from "@stockright/shared/api";
import { createWarehouseSchema, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { tokens } from "@stockright/shared/tokens";

export default function CreateWarehouseScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ warehouseName: "", location: "", capacityTonnes: "" });

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit() {
    const payload = {
      warehouseName: form.warehouseName.trim(),
      location: form.location.trim() || undefined,
      capacityTonnes: form.capacityTonnes ? Number(form.capacityTonnes) : undefined,
    };
    const parsed = createWarehouseSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      const { warehouseId } = await createWarehouse(client, process.env.EXPO_PUBLIC_SUPABASE_URL!, parsed.data);
      await storage.set(ACTIVE_WAREHOUSE_ID_KEY, warehouseId);
      router.replace("/");
    } catch (err: unknown) {
      setErrors({ _form: (err as Error).message ?? "Failed to create warehouse." });
    } finally {
      setIsLoading(false);
    }
  }

  const fields = [
    { key: "warehouseName" as const, label: "Warehouse Name", placeholder: "Sri Balaji Cold Storage — Unit 1", helper: undefined },
    { key: "location" as const, label: "Location", placeholder: "Vijayawada, Andhra Pradesh", helper: "Optional — city or area" },
    { key: "capacityTonnes" as const, label: "Total Capacity (MT)", placeholder: "5000", helper: "Optional — metric tonnes" },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Set up your warehouse</Text>
      <Text style={styles.subheading}>You can add more warehouses later from settings</Text>

      <View style={styles.card}>
        {fields.map(({ key, label, placeholder, helper }) => (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={[styles.input, errors[key] ? styles.inputError : styles.inputDefault]}
              value={form[key]}
              onChangeText={(t) => setField(key, t)}
              placeholder={placeholder}
              placeholderTextColor={tokens.textPlaceholder}
              keyboardType={key === "capacityTonnes" ? "numeric" : "default"}
              autoFocus={key === "warehouseName"}
            />
            {errors[key] ? (
              <Text style={styles.fieldError}>{errors[key]}</Text>
            ) : helper ? (
              <Text style={styles.helper}>{helper}</Text>
            ) : null}
          </View>
        ))}

        {errors._form ? <Text style={styles.formError}>{errors._form}</Text> : null}

        <Button
          full
          loading={isLoading}
          disabled={!form.warehouseName.trim()}
          loadingLabel="Creating…"
          onPress={handleSubmit}
        >
          Create Warehouse
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 48, gap: 8 },
  heading: { fontSize: 24, fontFamily: "NotoSans-SemiBold", color: tokens.textPrimary, textAlign: "center" },
  subheading: { fontSize: 14, fontFamily: "NotoSans-Regular", color: tokens.textSecondary, textAlign: "center", marginBottom: 8 },
  card: { width: "100%", backgroundColor: tokens.bgSurface, borderRadius: tokens.radiusXl, borderWidth: 1, borderColor: tokens.borderDefault, padding: 20, gap: 16, marginTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "NotoSans-Medium", color: tokens.textSecondary },
  input: { borderRadius: tokens.radiusMd, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 16, fontFamily: "NotoSans-Regular", color: tokens.textPrimary, minHeight: 48 },
  inputDefault: { borderColor: tokens.borderDefault },
  inputError: { borderColor: tokens.outward },
  fieldError: { fontSize: 12, fontFamily: "NotoSans-Regular", color: tokens.outward },
  helper: { fontSize: 12, fontFamily: "NotoSans-Regular", color: tokens.textTertiary },
  formError: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.outward, textAlign: "center" },
});
