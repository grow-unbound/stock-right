// Shared auth hook — platform-agnostic state logic.
// Platform-specific session persistence is handled in apps/web and apps/mobile.

import { useState, useCallback } from "react";
import { sendOtp, verifyOtp, OtpError } from "../api/auth";
import type { SendOtpResult, VerifyOtpResult } from "../types/models";

export interface UseOtpState {
  challengeId: string | null;
  sentTo: string | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
}

export function useOtpFlow(supabaseUrl: string, supabaseAnonKey: string) {
  const [state, setState] = useState<UseOtpState>({
    challengeId: null,
    sentTo: null,
    isLoading: false,
    error: null,
    errorCode: null,
  });

  const requestOtp = useCallback(
    async (payload: Parameters<typeof sendOtp>[2]): Promise<SendOtpResult | null> => {
      setState((s) => ({ ...s, isLoading: true, error: null, errorCode: null }));
      try {
        const result = await sendOtp(supabaseUrl, supabaseAnonKey, payload);
        setState((s) => ({
          ...s,
          isLoading: false,
          challengeId: result.challengeId,
          sentTo: result.sentTo,
        }));
        return result;
      } catch (err) {
        const msg = err instanceof OtpError ? err.message : "Something went wrong. Try again.";
        const code = err instanceof OtpError ? err.code : "UNKNOWN";
        setState((s) => ({ ...s, isLoading: false, error: msg, errorCode: code }));
        return null;
      }
    },
    [supabaseUrl, supabaseAnonKey]
  );

  const confirmOtp = useCallback(
    async (code: string): Promise<VerifyOtpResult | null> => {
      if (!state.challengeId) return null;
      setState((s) => ({ ...s, isLoading: true, error: null, errorCode: null }));
      try {
        const result = await verifyOtp(supabaseUrl, supabaseAnonKey, state.challengeId, code);
        setState((s) => ({ ...s, isLoading: false }));
        return result;
      } catch (err) {
        const msg = err instanceof OtpError ? err.message : "Something went wrong. Try again.";
        const code2 = err instanceof OtpError ? err.code : "UNKNOWN";
        setState((s) => ({ ...s, isLoading: false, error: msg, errorCode: code2 }));
        return null;
      }
    },
    [supabaseUrl, supabaseAnonKey, state.challengeId]
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, errorCode: null }));
  }, []);

  return { ...state, requestOtp, confirmOtp, clearError };
}
