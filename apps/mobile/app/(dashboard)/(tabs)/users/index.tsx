import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { UserCog, ChevronRight } from "lucide-react-native";
import {
  listTenantUsers,
  resolveTenantIdFromWarehouse,
  TENANT_USERS_REFRESH_EVENT,
  type TenantUserRow,
} from "@stockright/shared/api";
import { roleLabel, ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

export default function UsersTabIndex() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [rows, setRows] = useState<TenantUserRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!warehouseId) {
      setTenantId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const tid = await resolveTenantIdFromWarehouse(supabase, warehouseId);
      if (!cancelled) setTenantId(tid);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, warehouseId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    setLoading(true);
    try {
      const list = await listTenantUsers(supabase, tenantId);
      setRows(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [supabase, tenantId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TENANT_USERS_REFRESH_EVENT, () => void load());
    return () => sub.remove();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users & Roles</Text>
        <Text style={styles.headerSub}>People who can sign in</Text>
      </View>
      {!warehouseId || !tenantId ? (
        <Text style={styles.centerMsg}>Select a warehouse first.</Text>
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {loading && tenantId ? (
        <ActivityIndicator color={tokens.brandUi} style={{ marginTop: 24 }} />
      ) : null}
      {!loading && tenantId ? (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <UserCog color={tokens.textTertiary} size={40} strokeWidth={2} />
              <Text style={styles.emptyText}>No teammates yet.</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.addBtn}
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push("/users/new" as Href);
                }}
              >
                <Text style={styles.addBtnText}>Add user</Text>
              </Pressable>
            </View>
          ) : (
            rows.map((row) => (
              <Pressable
                key={row.userId}
                accessibilityRole="button"
                style={styles.row}
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push(`/users/${row.userId}` as Href);
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(row.fullName?.trim()?.[0] ?? row.phone.slice(-2)).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{row.fullName?.trim() || row.phone}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {roleLabel(row.role)}
                    {row.email ? ` · ${row.email}` : ""}
                  </Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text
                    style={[styles.badge, row.isActive ? styles.badgeOn : styles.badgeOff]}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </Text>
                  <ChevronRight color={tokens.textTertiary} size={22} strokeWidth={2} />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : null}
      {!loading && tenantId && rows.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          style={styles.fab}
          onPress={() => {
            void Haptics.selectionAsync();
            router.push("/users/new" as Href);
          }}
        >
          <Text style={styles.fabText}>Add user</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: tokens.textPrimary },
  headerSub: { fontSize: 14, color: tokens.textSecondary, marginTop: 4 },
  centerMsg: {
    padding: 16,
    fontSize: 15,
    color: tokens.textSecondary,
    textAlign: "center",
  },
  err: { paddingHorizontal: 16, color: tokens.outward, fontSize: 14 },
  list: { padding: 16, paddingBottom: 100, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    backgroundColor: tokens.bgSurface,
    minHeight: 56,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: tokens.brandText },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: tokens.textPrimary },
  rowSub: { fontSize: 13, color: tokens.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeOn: {
    backgroundColor: tokens.inwardBg,
    color: tokens.inward,
  },
  badgeOff: {
    backgroundColor: tokens.pendingBg,
    color: tokens.pending,
  },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: tokens.textSecondary },
  addBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: tokens.brandUi,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontSize: 16, fontWeight: "600", color: tokens.textOnBrand },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    left: 16,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: tokens.brandUi,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { fontSize: 16, fontWeight: "600", color: tokens.textOnBrand },
});
