import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Button } from "@/components/ui/Button";
import { sendOtp, OTP_ERROR_CODES } from "@stockright/shared/api";
import { indianPhoneSchema } from "@stockright/shared/utils";
import { storage } from "@/lib/storage";
import { tokens } from "@stockright/shared/tokens";

type PageState = "form" | "not_registered";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("form");

  async function handleSubmit() {
    const parsed = indianPhoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid number");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const result = await sendOtp(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { phone, purpose: "login" }
      );
      await storage.set("otp_challenge_id", result.challengeId);
      await storage.set("otp_sent_to", result.sentTo);
      await storage.set("otp_phone", phone);
      router.push("/(auth)/verify?from=login");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === OTP_ERROR_CODES.PHONE_NOT_FOUND) {
        setPageState("not_registered");
      } else {
        setError((err as Error).message ?? "Something went wrong.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (pageState === "not_registered") {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
          <Text style={styles.cardTitle}>Number Not Registered</Text>
          <Text style={styles.cardBody}>{phone} is not registered with StockRight.</Text>
          <Text style={styles.cardHint}>Contact your warehouse owner to get access.</Text>
          <View style={styles.cardActions}>
            <Button full onPress={() => router.push(`/(auth)/signup?phone=${encodeURIComponent(phone)}`)}>
              Create New Account
            </Button>
            <Button
              full
              variant="ghost"
              onPress={() => { setPhone(""); setPageState("form"); }}
            >
              Try a different number
            </Button>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.wordmarkRow} accessibilityRole="header">
          <Text style={styles.wordmarkStock}>Stock</Text>
          <Text style={styles.wordmarkRight}>Right</Text>
        </View>

        <Text style={styles.heading}>Log in to StockRight</Text>
        <Text style={styles.subheading}>We&apos;ll send a verification code to your email</Text>

        <View style={styles.formCard}>
          <PhoneInput value={phone} onChange={setPhone} error={error} autoFocus />
        <Button full loading={isLoading} disabled={!phone} loadingLabel="Sending…" onPress={handleSubmit}>
          Send Verification Code
        </Button>
        </View>

        <Text style={styles.footer}>
          Don&apos;t have an account?{" "}
          <Text
            style={styles.link}
            onPress={() => router.push("/(auth)/signup")}
          >
            Create one
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: tokens.bgPage,
  },
  screen: {
    flex: 1,
    backgroundColor: tokens.bgPage,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 8,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 24,
  },
  wordmarkStock: {
    fontSize: 28,
    fontFamily: "NotoSerif-SemiBold",
    color: tokens.textPrimary,
  },
  wordmarkRight: {
    fontSize: 28,
    fontFamily: "NotoSerif-SemiBold",
    color: tokens.brandText,
  },
  heading: {
    fontSize: 24,
    fontFamily: "NotoSans-SemiBold",
    color: tokens.textPrimary,
    textAlign: "center",
  },
  subheading: {
    fontSize: 14,
    fontFamily: "NotoSans-Regular",
    color: tokens.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  formCard: {
    width: "100%",
    backgroundColor: tokens.bgSurface,
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    padding: 20,
    gap: 16,
    marginTop: 8,
  },
  footer: {
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.textTertiary,
    textAlign: "center",
    marginTop: 16,
  },
  link: {
    color: tokens.brandText,
    fontFamily: "NotoSans-Medium",
  },
  // Not registered state
  card: {
    margin: 20,
    backgroundColor: tokens.bgSurface,
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.outwardBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockIcon: { fontSize: 20 },
  cardTitle: {
    fontSize: 18,
    fontFamily: "NotoSans-SemiBold",
    color: tokens.textPrimary,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: "NotoSans-Regular",
    color: tokens.textSecondary,
    textAlign: "center",
  },
  cardHint: {
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.textTertiary,
    textAlign: "center",
  },
  cardActions: { width: "100%", gap: 8, marginTop: 12 },
});
