"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { sendOtp, OTP_ERROR_CODES } from "@stockright/shared/api";
import { signupSchema } from "@stockright/shared/utils";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    companyName: "",
    agreedToTerms: false,
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          phone: form.phone,
          email: form.email,
          fullName: form.fullName,
          purpose: "signup",
        }
      );
      sessionStorage.setItem("otp_challenge_id", result.challengeId);
      sessionStorage.setItem("otp_sent_to", result.sentTo);
      sessionStorage.setItem("otp_phone", form.phone);
      sessionStorage.setItem("otp_email", form.email);
      sessionStorage.setItem("otp_name", form.fullName);
      router.push("/verify?from=signup");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === OTP_ERROR_CODES.PHONE_EXISTS) {
        setErrors({ phone: "This number is already registered. Log in instead." });
      } else {
        setErrors({ _form: (err as Error).message ?? "Something went wrong. Try again." });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
          Create your account
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Set up StockRight for your cold storage
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-[var(--shadow-1)]"
      >
        <Input
          label="Full Name"
          placeholder="Ravi Kumar"
          value={form.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          error={errors.fullName}
          autoFocus
          autoComplete="name"
        />

        <PhoneInput
          value={form.phone}
          onChange={(v) => setField("phone", v)}
          error={errors.phone}
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="ravi@example.com"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          error={errors.email}
          helper="OTP will be sent to this email"
          autoComplete="email"
        />

        <Input
          label="Company / Warehouse Name"
          placeholder="Sri Balaji Cold Storage"
          value={form.companyName}
          onChange={(e) => setField("companyName", e.target.value)}
          error={errors.companyName}
        />

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={form.agreedToTerms}
              onChange={(e) => setField("agreedToTerms", e.target.checked)}
              className="sr-only peer"
            />
            <div
              className={`
                w-5 h-5 rounded-[var(--radius-sm)] border-[1.5px] flex items-center justify-center
                transition-colors duration-[var(--duration-fast)]
                peer-focus:ring-[3px] peer-focus:ring-[var(--focus-ring)]
                ${form.agreedToTerms
                  ? "bg-[var(--brand-ui)] border-[var(--brand-ui)]"
                  : errors.agreedToTerms
                  ? "border-[var(--outward)]"
                  : "border-[var(--border-default)]"
                }
              `}
            >
              {form.agreedToTerms && (
                <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                  <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            I agree to the{" "}
            <a href="/terms" target="_blank" className="text-[var(--brand-text)] font-medium underline-offset-2 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="text-[var(--brand-text)] font-medium underline-offset-2 hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>
        {errors.agreedToTerms && (
          <p className="text-[12px] text-[var(--outward)] -mt-2">{errors.agreedToTerms}</p>
        )}

        {errors._form && (
          <p className="text-[13px] text-[var(--outward)] text-center">{errors._form}</p>
        )}

        <Button
          type="submit"
          full
          loading={isLoading}
          disabled={!form.fullName || !form.phone || !form.email || !form.agreedToTerms}
        >
          Send Verification Code
        </Button>
      </form>

      <p className="text-center text-[13px] text-[var(--text-tertiary)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--brand-text)] font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
