import { Stack } from "expo-router";

export default function UsersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="[userId]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
