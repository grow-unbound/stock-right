"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendOtp, verifyOtp, warehouseFromVerifyOtpRow, OtpError, OTP_ERROR_CODES, OTP_EMAIL_DELIVERY_FAILED_HINT } from "@stockright/shared/api";
import { setActiveWarehouseIdAction } from "@/app/actions/session";

const OTP_EXPIRY_SECONDS = 600; // 10 min
const RESEND_COOLDOWN_SECONDS = 30;

function VerifyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") as "login" | "signup" | null;

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // ref prevents isVerifying from entering useCallback deps (which causes infinite retry loop)
  const isVerifyingRef = useRef(false);

  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiryCountdown, setExpiryCountdown] = useState(OTP_EXPIRY_SECONDS);
  const [isExpired, setIsExpired] = useState(false);

  const challengeId = typeof window !== "undefined"
    ? sessionStorage.getItem("otp_challenge_id") ?? ""
    : "";
  const sentTo = typeof window !== "undefined"
    ? sessionStorage.getItem("otp_sent_to") ?? ""
    : "";

  useEffect(() => {
    if (!challengeId) {
      router.replace(from === "signup" ? "/signup" : "/login");
    }
  }, [challengeId, from, router]);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // Expiry countdown
  useEffect(() => {
    if (expiryCountdown <= 0) {
      setIsExpired(true);
      return;
    }
    const t = setTimeout(() => setExpiryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [expiryCountdown]);

  const loginPath = from === "signup" ? "/signup" : "/login";

  const handleVerify = useCallback(async (code: string) => {
    if (code.length < 6 || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setError("");
    try {
      const result = await verifyOtp(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { challengeId, code }
      );

      // Write session to cookies so middleware (createServerClient) can read it
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.setSession({
        access_token: result.session.accessToken,
        refresh_token: result.session.refreshToken,
      });

      sessionStorage.removeItem("otp_challenge_id");
      sessionStorage.removeItem("otp_sent_to");
      sessionStorage.removeItem("otp_phone");

      if (result.nextStep === "create_warehouse") {
        router.push("/create-warehouse");
      } else if (result.nextStep === "select_warehouse") {
        router.push("/warehouse-select");
      } else {
        const w = warehouseFromVerifyOtpRow(result.warehouses?.[0]);
        if (w) {
          await setActiveWarehouseIdAction(w.id);
        }
        router.push("/");
      }
      // intentionally NOT resetting isVerifyingRef — page unmounts on navigation
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      if (errCode === "INVALID_CODE") {
        setError("Incorrect code. Check your email and try again.");
        isVerifyingRef.current = false;
        setIsVerifying(false);
      } else if (errCode === "TOO_MANY_ATTEMPTS") {
        // fatal: clear session and send back to login
        sessionStorage.removeItem("otp_challenge_id");
        sessionStorage.removeItem("otp_sent_to");
        sessionStorage.removeItem("otp_phone");
        router.replace(loginPath);
      } else if (errCode === "EXPIRED_CODE") {
        setIsExpired(true);
        setError("This code has expired. Request a new one.");
        isVerifyingRef.current = false;
        setIsVerifying(false);
      } else {
        // unrecoverable — send back to login
        sessionStorage.removeItem("otp_challenge_id");
        sessionStorage.removeItem("otp_sent_to");
        sessionStorage.removeItem("otp_phone");
        router.replace(loginPath);
      }
    }
  }, [challengeId, loginPath, router]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6) handleVerify(otp);
  }, [otp, handleVerify]);

  async function handleResend() {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setError("");
    try {
      // Re-read stored data from sessionStorage for resend
      const storedPhone = sessionStorage.getItem("otp_phone") ?? "";
      const storedEmail = sessionStorage.getItem("otp_email") ?? "";
      const storedName = sessionStorage.getItem("otp_name") ?? "";

      const result = await sendOtp(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        from === "signup"
          ? { phone: storedPhone, email: storedEmail, fullName: storedName, purpose: "signup" }
          : { phone: storedPhone, purpose: "login" }
      );
      sessionStorage.setItem("otp_challenge_id", result.challengeId);
      sessionStorage.setItem("otp_sent_to", result.sentTo);
      setOtp("");
      setIsExpired(false);
      setExpiryCountdown(OTP_EXPIRY_SECONDS);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(
        err instanceof OtpError && err.code === OTP_ERROR_CODES.EMAIL_FAILED
          ? OTP_EMAIL_DELIVERY_FAILED_HINT
          : err instanceof Error
            ? err.message
            : "Failed to resend. Try again."
      );
    } finally {
      setIsResending(false);
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
          Enter verification code
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          We sent a 6-digit code to
        </p>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">{sentTo}</p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-5 shadow-[var(--shadow-1)]">
        <OtpInput
          value={otp}
          onChange={setOtp}
          disabled={isVerifying || isExpired}
          error={error}
        />

        <Button
          type="button"
          full
          loading={isVerifying}
          loadingLabel="Verifying…"
          disabled={otp.length < 6 || isExpired}
          onClick={() => handleVerify(otp)}
        >
          Verify Code
        </Button>

        {!isExpired && (
          <p className="text-center text-[12px] text-[var(--text-tertiary)]">
            Code expires in{" "}
            <span className={expiryCountdown < 60 ? "text-[var(--outward)] font-medium" : ""}>
              {formatTime(expiryCountdown)}
            </span>
          </p>
        )}

        {isExpired && (
          <p className="text-center text-[13px] text-[var(--outward)]">
            Code expired. Request a new one below.
          </p>
        )}
      </div>

      <div className="text-center space-y-1">
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Didn&apos;t receive the code?
        </p>
        {resendCountdown > 0 && !isExpired ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Resend in{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {resendCountdown}s
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-[13px] font-medium text-[var(--brand-text)] disabled:opacity-50"
          >
            {isResending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>

      <p className="text-center text-[13px] text-[var(--text-tertiary)]">
        Wrong number?{" "}
        <button
          type="button"
          onClick={() => router.push(from === "signup" ? "/signup" : "/login")}
          className="text-[var(--brand-text)] font-medium"
        >
          Go back
        </button>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  );
}
