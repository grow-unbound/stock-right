import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { listWarehouses } from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { tokens } from "@stockright/shared/tokens";

export default function WarehouseSelectScreen() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    client.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) {
        router.replace("/(auth)/login");
        return;
      }
      listWarehouses(client, data.user.id)
        .then(setWarehouses)
        .catch((err: unknown) => setError((err as Error).message ?? "Failed to load."))
        .finally(() => setIsLoading(false));
    });
  }, [router]);

  async function handleSelect(warehouseId: string) {
    setSelecting(warehouseId);
    await storage.set("active_warehouse_id", warehouseId);
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Select warehouse</Text>
        <Text style={styles.subheading}>Choose which warehouse to open</Text>

        {isLoading ? (
          <View style={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonCircle} />
                <View style={styles.skeletonLines}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!isLoading && error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        {!isLoading &&
          warehouses.map((wh) => (
            <TouchableOpacity
              key={wh.id}
              style={[styles.card, selecting === wh.id && styles.cardSelecting]}
              onPress={() => handleSelect(wh.id)}
              disabled={!!selecting}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>⊟</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {wh.warehouseName}
                </Text>
                {wh.city ? (
                  <Text style={styles.location} numberOfLines={1}>
                    {[wh.city, wh.state].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
              </View>
              {selecting === wh.id ? (
                <Text style={styles.selectingLabel}>Opening…</Text>
              ) : null}
            </TouchableOpacity>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bgPage },
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 48, gap: 12 },
  heading: {
    fontSize: 24,
    fontFamily: "NotoSans-SemiBold",
    color: tokens.textPrimary,
    textAlign: "center",
  },
  subheading: {
    fontSize: 14,
    fontFamily: "NotoSans-Regular",
    color: tokens.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  skeletonList: { gap: 12, marginTop: 8 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.bgSurface,
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    padding: 16,
  },
  skeletonCircle: { width: 40, height: 40, borderRadius: tokens.radiusMd, backgroundColor: tokens.bgSubtle },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLine: { height: 14, width: "75%", backgroundColor: tokens.bgSubtle, borderRadius: 4 },
  skeletonLineShort: { width: "50%" },
  error: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.outward, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.bgSurface,
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    padding: 16,
  },
  cardSelecting: { borderColor: tokens.brandUi },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.inwardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18, color: tokens.inward },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: "NotoSans-SemiBold", color: tokens.textPrimary },
  location: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.textSecondary, marginTop: 2 },
  selectingLabel: {
    fontSize: 12,
    fontFamily: "NotoSans-Medium",
    color: tokens.brandText,
  },
});
