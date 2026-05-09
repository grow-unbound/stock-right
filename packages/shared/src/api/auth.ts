import type { SendOtpResult, VerifyOtpResult } from "../types/models";

// Calls Supabase Edge Functions — identical on web and mobile.
// Web: passes cookies-based session. Mobile: stores in AsyncStorage.

export interface SendOtpPayload {
  phone: string;
  email?: string;
  purpose: "login" | "signup";
  fullName?: string;
  companyName?: string;
}

function otpErrorFields(body: unknown): { error: string; code: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Request failed", code: "UNKNOWN" };
  }
  const o = body as Record<string, unknown>;
  return {
    error: typeof o.error === "string" ? o.error : "Request failed",
    code: typeof o.code === "string" ? o.code : "UNKNOWN",
  };
}

export async function sendOtp(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: SendOtpPayload
): Promise<SendOtpResult> {
  const res = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await res.json();

  if (!res.ok) {
    const { error, code } = otpErrorFields(data);
    throw new OtpError(error, code);
  }

  return data as SendOtpResult;
}

export interface VerifyOtpPayload {
  challengeId: string;
  code: string;
}

export async function verifyOtp(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: VerifyOtpPayload
): Promise<VerifyOtpResult> {
  const res = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await res.json();

  if (!res.ok) {
    const { error, code } = otpErrorFields(data);
    throw new OtpError(error, code);
  }

  return data as VerifyOtpResult;
}

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "OtpError";
  }
}

// Typed error codes returned by Edge Functions
export const OTP_ERROR_CODES = {
  PHONE_NOT_FOUND: "PHONE_NOT_FOUND",
  PHONE_EXISTS: "PHONE_EXISTS",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  INVALID_CODE: "INVALID_CODE",
  EXPIRED_CODE: "EXPIRED_CODE",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  RATE_LIMITED: "RATE_LIMITED",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
} as const;

export type OtpErrorCode = (typeof OTP_ERROR_CODES)[keyof typeof OTP_ERROR_CODES];
