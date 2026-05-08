import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@stockright/shared/tokens";

export default function OnboardingLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bgPage }} edges={["top", "bottom", "left", "right"]}>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="create-warehouse" />
      </Stack>
    </SafeAreaView>
  );
}
