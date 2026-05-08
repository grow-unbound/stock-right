import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { DashboardTabBar } from "@/components/layout/DashboardTabBar";
import { OfflineBanner } from "@/components/landing/OfflineBanner";
import { LandingFab } from "@/components/landing/LandingFab";
import { useIsOffline } from "@/hooks/useIsOffline";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { MoneyAccessProvider, useMoneyAccessContext } from "@/contexts/MoneyAccessContext";

function DashboardTabsInner() {
  const offline = useIsOffline();
  const { canManageMoney, loaded: moneyAccessLoaded } = useMoneyAccessContext();

  const moneyHref = moneyAccessLoaded && !canManageMoney ? null : undefined;

  return (
    <View style={styles.root}>
      {offline && <OfflineBanner queueCount={DEMO_PROFILE_USER.offlineQueuedCount} />}
      <Tabs
        tabBar={(props) => <DashboardTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="stock" options={{ title: "Stock" }} />
        <Tabs.Screen name="parties" options={{ title: "Parties" }} />
        <Tabs.Screen name="money" options={{ title: "Money", href: moneyHref }} />
      </Tabs>
      <LandingFab />
    </View>
  );
}

export default function DashboardTabsLayout() {
  return (
    <MoneyAccessProvider>
      <DashboardTabsInner />
    </MoneyAccessProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
});
