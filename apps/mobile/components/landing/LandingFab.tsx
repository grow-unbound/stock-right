import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Plus } from "lucide-react-native";
import { usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LandingFabAction } from "@stockright/shared/demo";
import {
  DEMO_FAB_MONEY_ACTIONS,
  DEMO_FAB_PARTIES_ACTIONS,
  DEMO_FAB_STOCK_ACTIONS,
} from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { FabActionSheet } from "./FabActionSheet";

/** Keep in sync with `DashboardTabBar` height + `globals.css` `--tabbar-height` */
const TABBAR_BASE = 64;
const STROKE = 2;

function resolveFabConfig(segmentTab: string | undefined): {
  title: string;
  actions: LandingFabAction[];
} | null {
  if (segmentTab === "stock") return { title: "Add to stock", actions: DEMO_FAB_STOCK_ACTIONS };
  if (segmentTab === "parties") return { title: "Add party", actions: DEMO_FAB_PARTIES_ACTIONS };
  if (segmentTab === "money") return { title: "Record money", actions: DEMO_FAB_MONEY_ACTIONS };
  return null;
}

export function LandingFab() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const segmentTab = useMemo(() => {
    if (pathname === "/stock") return "stock";
    if (pathname === "/parties") return "parties";
    if (pathname === "/money") return "money";
    return undefined;
  }, [pathname]);

  const config = resolveFabConfig(segmentTab);
  const bottomPad = Math.max(insets.bottom, 8);
  const bottomOffset = TABBAR_BASE + bottomPad + 16;

  if (!config) return null;

  async function handleFabPress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen(true);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={config.title}
        onPress={() => void handleFabPress()}
        style={[styles.fab, { bottom: bottomOffset }]}
      >
        <Plus size={26} color={tokens.textOnBrand} strokeWidth={STROKE} />
      </Pressable>
      <FabActionSheet
        open={open}
        title={config.title}
        actions={config.actions}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: tokens.sp4,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.brandUi,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    shadowColor: tokens.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
});
