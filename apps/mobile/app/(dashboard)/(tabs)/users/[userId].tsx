import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  listTenantUsers,
  listWarehousesForTenant,
  resolveTenantIdFromWarehouse,
  type TenantUserRow,
} from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { MobileTenantUserForm } from "@/components/users/MobileTenantUserForm";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

export default function UsersEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = typeof params.userId === "string" ? params.userId : null;

  const supabase = useMemo(() => getSupabaseClient(), []);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [row, setRow] = useState<TenantUserRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void storage.get(ACTIVE_WAREHOUSE_ID_KEY).then((id) => {
      if (cancelled) return;
      setWarehouseId(id && id.length > 0 ? id : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!warehouseId || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const tid = await resolveTenantIdFromWarehouse(supabase, warehouseId);
        if (cancelled || !tid) return;
        setTenantId(tid);
        const [users, whs] = await Promise.all([
          listTenantUsers(supabase, tid),
          listWarehousesForTenant(supabase, tid),
        ]);
        if (cancelled) return;
        setWarehouses(whs);
        const found = users.find((u) => u.userId === userId) ?? null;
        setRow(found);
        if (!found) setError("User not found.");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, warehouseId, userId]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            router.back();
          }}
          style={styles.back}
        >
          <ChevronLeft color={tokens.textPrimary} size={24} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Edit User</Text>
      </View>
      {tenantId && row ? (
        <MobileTenantUserForm
          mode="edit"
          tenantId={tenantId}
          warehouses={warehouses}
          initial={row}
          onClose={() => router.back()}
        />
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
  },
  back: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: tokens.textPrimary },
  err: { padding: 16, fontSize: 15, color: tokens.outward },
});
