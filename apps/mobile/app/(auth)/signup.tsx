import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Button } from "@/components/ui/Button";
import { sendOtp, OTP_ERROR_CODES, OtpError, OTP_EMAIL_DELIVERY_FAILED_HINT } from "@stockright/shared/api";
import { signupSchema } from "@stockright/shared/utils";
import { storage } from "@/lib/storage";
import { tokens } from "@stockright/shared/tokens";

export default function SignupScreen() {
  const router = useRouter();
  const { phone: initialPhone } = useLocalSearchParams<{ phone?: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    phone: initialPhone ?? "",
    email: "",
    companyName: "",
    agreedToTerms: false,
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit() {
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    try {
      const result = await sendOtp(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { phone: form.phone, email: form.email, fullName: form.fullName, purpose: "signup" }
      );
      await storage.set("otp_challenge_id", result.challengeId);
      await storage.set("otp_sent_to", result.sentTo);
      await storage.set("otp_phone", form.phone);
      await storage.set("otp_email", form.email);
      await storage.set("otp_name", form.fullName);
      router.push("/(auth)/verify?from=signup");
    } catch (err: unknown) {
      if (err instanceof OtpError && err.code === OTP_ERROR_CODES.PHONE_EXISTS) {
        setErrors({ phone: "Already registered. Log in instead." });
      } else if (err instanceof OtpError && err.code === OTP_ERROR_CODES.EMAIL_EXISTS) {
        setErrors({ email: "Already registered. Log in instead." });
      } else if (err instanceof OtpError && err.code === OTP_ERROR_CODES.EMAIL_FAILED) {
        setErrors({ _form: OTP_EMAIL_DELIVERY_FAILED_HINT });
      } else {
        setErrors({ _form: err instanceof Error ? err.message : "Something went wrong." });
      }
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subheading}>Set up StockRight for your cold storage</Text>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.fullName ? styles.inputError : styles.inputDefault]}
              value={form.fullName}
              onChangeText={(t) => setField("fullName", t)}
              placeholder="Ravi Kumar"
              placeholderTextColor={tokens.textPlaceholder}
              autoComplete="name"
              returnKeyType="next"
            />
            {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}
          </View>

          <PhoneInput value={form.phone} onChange={(v) => setField("phone", v)} error={errors.phone} />

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : styles.inputDefault]}
              value={form.email}
              onChangeText={(t) => setField("email", t)}
              placeholder="ravi@example.com"
              placeholderTextColor={tokens.textPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
            {errors.email ? (
              <Text style={styles.fieldError}>{errors.email}</Text>
            ) : (
              <Text style={styles.helper}>OTP will be sent to this email</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Company / Warehouse Name</Text>
            <TextInput
              style={[styles.input, errors.companyName ? styles.inputError : styles.inputDefault]}
              value={form.companyName}
              onChangeText={(t) => setField("companyName", t)}
              placeholder="Sri Balaji Cold Storage"
              placeholderTextColor={tokens.textPlaceholder}
              returnKeyType="done"
            />
            {errors.companyName ? <Text style={styles.fieldError}>{errors.companyName}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setField("agreedToTerms", !form.agreedToTerms)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              form.agreedToTerms ? styles.checkboxChecked : styles.checkboxUnchecked,
              errors.agreedToTerms ? styles.checkboxError : null,
            ]}>
              {form.agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              I agree to the Terms of Service and Privacy Policy
            </Text>
          </TouchableOpacity>
          {errors.agreedToTerms ? <Text style={styles.fieldError}>{errors.agreedToTerms}</Text> : null}

          {errors._form ? <Text style={styles.formError}>{errors._form}</Text> : null}

          <Button
            full
            loading={isLoading}
            disabled={!form.fullName || !form.phone || !form.email || !form.agreedToTerms}
            loadingLabel="Sending…"
            onPress={handleSubmit}
          >
            Send Verification Code
          </Button>
        </View>
        <Text style={styles.footer}>
          Already have an account?{" "}
          <Text style={styles.link} onPress={() => router.push("/(auth)/login")}>
            Log in
          </Text>
        </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 8,
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
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "NotoSans-Medium", color: tokens.textSecondary },
  input: {
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    backgroundColor: tokens.bgSurface,
    paddingHorizontal: 12,
    fontSize: 16, // LOCKED
    fontFamily: "NotoSans-Regular",
    color: tokens.textPrimary,
    minHeight: 48,
  },
  inputDefault: { borderColor: tokens.borderDefault },
  inputError: { borderColor: tokens.outward },
  fieldError: { fontSize: 12, fontFamily: "NotoSans-Regular", color: tokens.outward },
  helper: { fontSize: 12, fontFamily: "NotoSans-Regular", color: tokens.textTertiary },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: tokens.brandUi, borderColor: tokens.brandUi },
  checkboxUnchecked: { borderColor: tokens.borderDefault },
  checkboxError: { borderColor: tokens.outward },
  checkmark: { fontSize: 12, color: "#FFFFFF", fontFamily: "NotoSans-SemiBold" },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.textSecondary,
    lineHeight: 20,
  },
  formError: {
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.outward,
    textAlign: "center",
  },
  footer: {
    fontSize: 13,
    fontFamily: "NotoSans-Regular",
    color: tokens.textTertiary,
    textAlign: "center",
    marginTop: 16,
  },
  link: { color: tokens.brandText, fontFamily: "NotoSans-Medium" },
});
