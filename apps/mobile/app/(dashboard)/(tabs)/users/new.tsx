import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listWarehousesForTenant, resolveTenantIdFromWarehouse } from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { MobileTenantUserForm } from "@/components/users/MobileTenantUserForm";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

export default function UsersNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

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
    if (!warehouseId) return;
    let cancelled = false;
    void (async () => {
      try {
        const tid = await resolveTenantIdFromWarehouse(supabase, warehouseId);
        if (cancelled || !tid) return;
        setTenantId(tid);
        const whs = await listWarehousesForTenant(supabase, tid);
        if (!cancelled) setWarehouses(whs);
      } catch (e: unknown) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Could not load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, warehouseId]);

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
        <Text style={styles.title}>Add User</Text>
      </View>
      {tenantId && !loadErr ? (
        <MobileTenantUserForm
          mode="create"
          tenantId={tenantId}
          warehouses={warehouses}
          onClose={() => router.back()}
        />
      ) : null}
      {!warehouseId ? (
        <Text style={styles.msg}>Select a warehouse first.</Text>
      ) : null}
      {loadErr ? <Text style={styles.err}>{loadErr}</Text> : null}
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
  msg: { padding: 16, fontSize: 15, color: tokens.textSecondary },
  err: { padding: 16, fontSize: 15, color: tokens.outward },
});
