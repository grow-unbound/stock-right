import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "expo-router";
import { View, StyleSheet } from "react-native";
import { listWarehouses } from "@stockright/shared/api";
import { ACTIVE_WAREHOUSE_ID_KEY } from "@stockright/shared/utils";
import { tokens } from "@stockright/shared/tokens";
import { getSupabaseClient } from "@/lib/supabase";
import { storage } from "@/lib/storage";

export function WarehouseGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const client = getSupabaseClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const warehouses = await listWarehouses(client, user.id);

      if (warehouses.length === 0) {
        router.replace("/(onboarding)/create-warehouse");
        return;
      }

      if (warehouses.length === 1) {
        await storage.set(ACTIVE_WAREHOUSE_ID_KEY, warehouses[0]!.id);
        if (!cancelled) setReady(true);
        return;
      }

      const active = await storage.get(ACTIVE_WAREHOUSE_ID_KEY);
      const valid = Boolean(active && warehouses.some((w) => w.id === active));
      if (!valid) {
        const onSelectScreen =
          pathname === "/warehouse-select" ||
          (typeof pathname === "string" && pathname.includes("warehouse-select"));
        if (!onSelectScreen) {
          router.replace("/warehouse-select");
        }
        return;
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <View style={styles.skelBar} />
        <View style={[styles.skelBar, styles.skelBarShort]} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.bgPage,
    gap: 12,
    paddingHorizontal: 48,
  },
  skelBar: {
    height: 14,
    width: "100%",
    maxWidth: 200,
    borderRadius: 6,
    backgroundColor: tokens.bgSubtle,
  },
  skelBarShort: {
    width: "60%",
    maxWidth: 140,
  },
});
