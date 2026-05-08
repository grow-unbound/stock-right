import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { gluestackConfig } from "@/theme";
import { tokens } from "@stockright/shared/tokens";
import * as SplashScreen from "expo-splash-screen";
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  useFonts as useNotoSansFonts,
} from "@expo-google-fonts/noto-sans";
import { NotoSerif_400Regular, NotoSerif_600SemiBold } from "@expo-google-fonts/noto-serif";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useNotoSansFonts({
    "NotoSans-Regular": NotoSans_400Regular,
    "NotoSans-Medium": NotoSans_500Medium,
    "NotoSans-SemiBold": NotoSans_600SemiBold,
    "NotoSerif-Regular": NotoSerif_400Regular,
    "NotoSerif-SemiBold": NotoSerif_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GluestackUIProvider config={gluestackConfig}>
        <StatusBar style="dark" backgroundColor={tokens.bgPage} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(dashboard)" />
          <Stack.Screen name="warehouse-select" />
        </Stack>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
