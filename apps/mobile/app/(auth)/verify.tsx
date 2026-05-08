import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { sendOtp, verifyOtp } from "@stockright/shared/api";
import { storage } from "@/lib/storage";
import { tokens } from "@stockright/shared/tokens";

const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [challengeId, setChallengeId] = useState("");

  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiryCountdown, setExpiryCountdown] = useState(OTP_EXPIRY_SECONDS);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    Promise.all([
      storage.get("otp_challenge_id"),
      storage.get("otp_sent_to"),
    ]).then(([id, to]) => {
      if (!id) {
        router.replace(from === "signup" ? "/(auth)/signup" : "/(auth)/login");
        return;
      }
      setChallengeId(id);
      setSentTo(to ?? "");
    });
  }, [from, router]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (expiryCountdown <= 0) { setIsExpired(true); return; }
    const t = setTimeout(() => setExpiryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [expiryCountdown]);

  const handleVerify = useCallback(async (code: string) => {
    if (code.length < 6 || isVerifying || !challengeId) return;
    setIsVerifying(true);
    setError("");
    try {
      const result = await verifyOtp(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { challengeId, code }
      );
      await storage.remove("otp_challenge_id");
      await storage.remove("otp_sent_to");

      if (result.nextStep === "create_warehouse") {
        router.replace("/(onboarding)/create-warehouse");
      } else if (result.nextStep === "select_warehouse") {
        router.replace("/warehouse-select");
      } else {
        router.replace("/");
      }
    } catch (err: unknown) {
      const code2 = (err as { code?: string }).code;
      if (code2 === "INVALID_OTP") setError("Incorrect code. Check your email and try again.");
      else if (code2 === "TOO_MANY_ATTEMPTS") setError("Too many attempts. Request a new code.");
      else if (code2 === "OTP_EXPIRED") { setIsExpired(true); setError("Code expired. Request a new one."); }
      else setError((err as Error).message ?? "Something went wrong.");
      setIsVerifying(false);
    }
  }, [challengeId, isVerifying, router]);

  useEffect(() => {
    if (otp.length === 6) handleVerify(otp);
  }, [otp, handleVerify]);

  async function handleResend() {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setError("");
    try {
      const [phone, email, name] = await Promise.all([
        storage.get("otp_phone"),
        storage.get("otp_email"),
        storage.get("otp_name"),
      ]);
      const result = await sendOtp(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        from === "signup"
          ? { phone: phone!, email: email!, fullName: name!, purpose: "signup" }
          : { phone: phone!, purpose: "login" }
      );
      await storage.set("otp_challenge_id", result.challengeId);
      await storage.set("otp_sent_to", result.sentTo);
      setChallengeId(result.challengeId);
      setSentTo(result.sentTo);
      setOtp("");
      setIsExpired(false);
      setExpiryCountdown(OTP_EXPIRY_SECONDS);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to resend.");
    } finally {
      setIsResending(false);
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
        <Text style={styles.heading}>Enter verification code</Text>
        <Text style={styles.subheading}>We sent a 6-digit code to</Text>
        <Text style={styles.sentTo}>{sentTo}</Text>

        <View style={styles.card}>
          <OtpInput value={otp} onChange={setOtp} disabled={isVerifying || isExpired} error={error} />

          <Button
            full
            loading={isVerifying}
            disabled={otp.length < 6 || isExpired}
            loadingLabel="Verifying…"
            onPress={() => handleVerify(otp)}
          >
            Verify Code
          </Button>

          {!isExpired && (
            <Text style={[styles.timer, expiryCountdown < 60 && styles.timerUrgent]}>
              Code expires in {formatTime(expiryCountdown)}
            </Text>
          )}
          {isExpired && (
            <Text style={styles.expiredText}>Code expired. Request a new one below.</Text>
          )}
        </View>

        <View style={styles.resendSection}>
          <Text style={styles.resendHint}>Didn&apos;t receive the code?</Text>
          {resendCountdown > 0 && !isExpired ? (
            <Text style={styles.resendCountdown}>Resend in {resendCountdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isResending}>
              <Text style={[styles.resendLink, isResending && styles.resendLinkDisabled]}>
                {isResending ? "Sending…" : "Resend code"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => router.push(from === "signup" ? "/(auth)/signup" : "/(auth)/login")}>
          <Text style={styles.backLink}>
            Wrong number? <Text style={styles.link}>Go back</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1, backgroundColor: tokens.bgPage },
  screen: { flex: 1, backgroundColor: tokens.bgPage },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 8,
  },
  heading: { fontSize: 24, fontFamily: "NotoSans-SemiBold", color: tokens.textPrimary, textAlign: "center" },
  subheading: { fontSize: 14, fontFamily: "NotoSans-Regular", color: tokens.textSecondary, textAlign: "center" },
  sentTo: { fontSize: 14, fontFamily: "NotoSans-Medium", color: tokens.textPrimary, textAlign: "center", marginBottom: 8 },
  card: {
    width: "100%",
    backgroundColor: tokens.bgSurface,
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    borderColor: tokens.borderDefault,
    padding: 20,
    gap: 16,
    marginTop: 8,
  },
  timer: { fontSize: 12, fontFamily: "NotoSans-Regular", color: tokens.textTertiary, textAlign: "center" },
  timerUrgent: { color: tokens.outward, fontFamily: "NotoSans-Medium" },
  expiredText: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.outward, textAlign: "center" },
  resendSection: { alignItems: "center", gap: 4, marginTop: 16 },
  resendHint: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.textTertiary },
  resendCountdown: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.textSecondary },
  resendLink: { fontSize: 13, fontFamily: "NotoSans-Medium", color: tokens.brandText },
  resendLinkDisabled: { opacity: 0.5 },
  backLink: { fontSize: 13, fontFamily: "NotoSans-Regular", color: tokens.textTertiary, marginTop: 16 },
  link: { color: tokens.brandText, fontFamily: "NotoSans-Medium" },
});
