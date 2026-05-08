import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@stockright/shared/tokens";

export default function AuthLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bgPage }} edges={["top", "bottom", "left", "right"]}>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify" />
      </Stack>
    </SafeAreaView>
  );
}
