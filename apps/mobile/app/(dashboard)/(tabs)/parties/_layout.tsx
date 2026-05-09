import { Stack } from "expo-router";

export default function PartiesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
