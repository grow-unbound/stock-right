import { Stack } from "expo-router";

export default function MoneyStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="receipt/new" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
