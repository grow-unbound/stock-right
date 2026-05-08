import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { DashboardTabBar } from "@/components/layout/DashboardTabBar";
import { OfflineBanner } from "@/components/landing/OfflineBanner";
import { LandingFab } from "@/components/landing/LandingFab";
import { useIsOffline } from "@/hooks/useIsOffline";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";

export default function DashboardTabsLayout() {
  const offline = useIsOffline();

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
        <Tabs.Screen name="money" options={{ title: "Money" }} />
      </Tabs>
      <LandingFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
});
