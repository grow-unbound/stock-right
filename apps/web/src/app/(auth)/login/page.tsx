"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Button } from "@/components/ui/Button";
import { sendOtp, OTP_ERROR_CODES, OtpError, OTP_EMAIL_DELIVERY_FAILED_HINT } from "@stockright/shared/api";
import { indianPhoneSchema } from "@stockright/shared/utils";
import { Lock } from "lucide-react";

type PageState = "form" | "not_registered";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("form");
  const isSubmittingRef = useRef(false);

  const isPhoneValid = indianPhoneSchema.safeParse(phone).success;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const parsed = indianPhoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid number");
      return;
    }

    setError("");
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const result = await sendOtp(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { phone, purpose: "login" }
      );
      sessionStorage.setItem("otp_challenge_id", result.challengeId);
      sessionStorage.setItem("otp_sent_to", result.sentTo);
      sessionStorage.setItem("otp_phone", phone);
      router.push("/verify?from=login");
      // intentionally NOT resetting isLoading — page unmounts on navigation
    } catch (err: unknown) {
      if (err instanceof OtpError && err.code === OTP_ERROR_CODES.EMAIL_FAILED) {
        setError(OTP_EMAIL_DELIVERY_FAILED_HINT);
      } else if (err instanceof OtpError && err.code === OTP_ERROR_CODES.PHONE_NOT_FOUND) {
        setPageState("not_registered");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  }

  if (pageState === "not_registered") {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center space-y-4 shadow-[var(--shadow-1)]">
        <div className="w-12 h-12 rounded-full bg-[var(--outward-bg)] flex items-center justify-center mx-auto">
          <Lock size={20} className="text-[var(--outward)]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
            Number Not Registered
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)]">
            {phone} is not registered with StockRight.
          </p>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Contact your warehouse owner to get access.
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <Link href={`/signup?phone=${encodeURIComponent(phone)}`}>
            <Button variant="primary" full>Create New Account</Button>
          </Link>
          <Button
            variant="ghost"
            full
            onClick={() => { setPhone(""); setPageState("form"); }}
          >
            Try a different number
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
          Log in to StockRight
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          We&apos;ll send a verification code to your email
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-[var(--shadow-1)]"
      >
        <PhoneInput value={phone} onChange={setPhone} error={error} autoFocus />
        <Button type="submit" full loading={isLoading} disabled={!isPhoneValid} loadingLabel="Sending…">
          Send Verification Code
        </Button>
      </form>

      <p className="text-center text-[13px] text-[var(--text-tertiary)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--brand-text)] font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
