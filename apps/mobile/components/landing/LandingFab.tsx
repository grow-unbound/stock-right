import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Plus } from "lucide-react-native";
import { usePathname, useRouter } from "expo-router";
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
import { useMoneyAccessContext } from "@/contexts/MoneyAccessContext";
import { BrandedAlertModal } from "@/components/ui/BrandedAlertModal";

/** Keep in sync with `DashboardTabBar` height + `globals.css` `--tabbar-height` */
const TABBAR_BASE = 64;
const STROKE = 2;

function resolveFabConfig(segmentTab: string | undefined, allowMoneyFab: boolean): {
  title: string;
  actions: LandingFabAction[];
} | null {
  if (segmentTab === "stock") return { title: "Add to stock", actions: DEMO_FAB_STOCK_ACTIONS };
  if (segmentTab === "parties") return { title: "Add party", actions: DEMO_FAB_PARTIES_ACTIONS };
  if (segmentTab === "money" && allowMoneyFab) return { title: "Record money", actions: DEMO_FAB_MONEY_ACTIONS };
  return null;
}

export function LandingFab() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const { canManageMoney, loaded: moneyAccessLoaded } = useMoneyAccessContext();

  const segmentTab = useMemo(() => {
    if (!pathname) return undefined;
    if (
      pathname.includes("/receipt/new") ||
      pathname.includes("/payment/new") ||
      pathname.includes("/parties/new") ||
      pathname.includes("/stock/lot/new")
    ) {
      return undefined;
    }
    if (pathname.startsWith("/stock")) return "stock";
    if (pathname.startsWith("/parties")) return "parties";
    if (pathname.startsWith("/money")) return "money";
    return undefined;
  }, [pathname]);

  const allowMoneyFab = !moneyAccessLoaded || canManageMoney;
  const config = resolveFabConfig(segmentTab, allowMoneyFab);
  const bottomPad = Math.max(insets.bottom, 8);
  const bottomOffset = TABBAR_BASE + bottomPad + 16;

  if (!config) return null;

  async function handleFabPress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen(true);
  }

  function handleFabActionSelect(id: string) {
    if (segmentTab === "money") {
      if (id === "add_receipt") router.push("/money/receipt/new");
      if (id === "add_payment") router.push("/money/payment/new");
      return;
    }
    if (segmentTab === "parties" && id === "add_party") {
      router.push("/parties/new");
      return;
    }
    if (segmentTab === "stock") {
      if (id === "add_lot") router.push("/stock/lot/new");
      if (id === "add_delivery") setComingSoonOpen(true);
    }
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
        onSelect={handleFabActionSelect}
      />
      <BrandedAlertModal
        visible={comingSoonOpen}
        title="Coming soon"
        message="Record dispatch will be available in a later update."
        onConfirm={() => setComingSoonOpen(false)}
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
