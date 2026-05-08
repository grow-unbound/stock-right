import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@stockright/shared/tokens";

export default function DashboardLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bgPage }} edges={["top", "left", "right"]}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
      </Stack>
    </SafeAreaView>
  );
}
