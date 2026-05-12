import { View, StyleSheet } from "react-native";
import { Tabs, usePathname } from "expo-router";
import { DashboardTabBar } from "@/components/layout/DashboardTabBar";
import { OfflineBanner } from "@/components/landing/OfflineBanner";
import { LandingFab } from "@/components/landing/LandingFab";
import { useIsOffline } from "@/hooks/useIsOffline";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { tokens } from "@stockright/shared/tokens";
import { MoneyAccessProvider, useMoneyAccessContext } from "@/contexts/MoneyAccessContext";
import {
  UserAdminAccessProvider,
  useUserAdminAccessContext,
} from "@/contexts/UserAdminAccessContext";

function hideDashboardTabBar(pathname: string): boolean {
  return (
    pathname.includes("/receipt/new") ||
    pathname.includes("/payment/new") ||
    pathname.includes("/parties/new") ||
    pathname.includes("/stock/lot/new") ||
    pathname.includes("/stock/delivery/new") ||
    pathname.startsWith("/users/")
  );
}

function DashboardTabsInner() {
  const offline = useIsOffline();
  const pathname = usePathname() ?? "";
  const hideTabs = hideDashboardTabBar(pathname);
  const { canManageMoney, loaded: moneyAccessLoaded } = useMoneyAccessContext();
  const { canManageTenantUsers, loaded: tenantUsersLoaded } = useUserAdminAccessContext();

  const moneyHref = moneyAccessLoaded && !canManageMoney ? null : undefined;
  const usersHref = tenantUsersLoaded && !canManageTenantUsers ? null : undefined;

  return (
    <View style={styles.root}>
      {offline && <OfflineBanner queueCount={DEMO_PROFILE_USER.offlineQueuedCount} />}
      <Tabs
        tabBar={(props) => (hideTabs ? null : <DashboardTabBar {...props} />)}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="stock" options={{ title: "Stock" }} />
        <Tabs.Screen name="parties" options={{ title: "Parties" }} />
        <Tabs.Screen name="money" options={{ title: "Money", href: moneyHref }} />
        <Tabs.Screen name="users" options={{ title: "Users", href: usersHref }} />
      </Tabs>
      <LandingFab />
    </View>
  );
}

export default function DashboardTabsLayout() {
  return (
    <MoneyAccessProvider>
      <UserAdminAccessProvider>
        <DashboardTabsInner />
      </UserAdminAccessProvider>
    </MoneyAccessProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgPage },
});
