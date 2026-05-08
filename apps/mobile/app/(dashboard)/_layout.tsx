import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@stockright/shared/tokens";
import { WarehouseGate } from "@/components/session/WarehouseGate";

export default function DashboardLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bgPage }} edges={["top", "left", "right"]}>
      <WarehouseGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
        </Stack>
      </WarehouseGate>
    </SafeAreaView>
  );
}
