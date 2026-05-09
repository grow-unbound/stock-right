import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@stockright.app";
const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const RESEND_RATE_WINDOW_SECONDS = 300; // 5 minutes
const MAX_RESENDS_IN_WINDOW = 3;

interface RequestBody {
  phone: string;
  email?: string;
  purpose: "login" | "signup";
  fullName?: string;
  companyName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { phone, email, purpose, fullName, companyName } = body;

    if (!phone || !purpose) {
      return error("MISSING_FIELDS", "phone and purpose are required", 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string;
    let sendToEmail: string;
    let recipientName: string;

    if (purpose === "login") {
      // Look up existing user by phone
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("id, email, display_name, is_active")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return error("PHONE_NOT_FOUND", "Phone not registered", 404);
      }
      if (profile.is_active === false) {
        return error("ACCOUNT_INACTIVE", "This account is inactive", 403);
      }
      if (!profile.email) {
        return error("NO_EMAIL", "No email on file for this account", 400);
      }
      userId = profile.id as string;
      sendToEmail = profile.email as string;
      recipientName = (profile.display_name as string) ?? "there";
    } else {
      // signup — email must be supplied in request
      if (!email) {
        return error("MISSING_FIELDS", "email is required for signup", 400);
      }

      // Check for duplicate phone
      const { data: existingPhone } = await adminClient
        .from("user_profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existingPhone) {
        return error("PHONE_EXISTS", "Phone already registered", 409);
      }

      // Check for duplicate email
      const { data: existingEmail } = await adminClient
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingEmail) {
        return error("EMAIL_EXISTS", "Email already registered", 409);
      }

      // Create auth.users entry (unconfirmed until OTP verified)
      const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
        phone,
        email,
        user_metadata: { full_name: fullName, company_name: companyName },
        phone_confirm: false,
        email_confirm: false,
      });
      if (authErr || !authUser?.user) {
        console.error("createUser error:", authErr);
        return error("CREATE_USER_FAILED", "Could not create account", 500);
      }
      userId = authUser.user.id;
      sendToEmail = email;
      recipientName = fullName ?? "there";
    }

    // Rate-limit: check recent resends in window
    const windowStart = new Date(Date.now() - RESEND_RATE_WINDOW_SECONDS * 1000).toISOString();
    const { count } = await adminClient
      .from("auth_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_RESENDS_IN_WINDOW) {
      return error("RATE_LIMITED", "Too many codes sent. Wait a few minutes.", 429);
    }

    // Generate OTP and hash
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const salt = crypto.randomUUID();
    const otpHash = await hashOtp(otp, salt);

    // Store challenge
    const { data: challenge, error: challengeErr } = await adminClient
      .from("auth_otp_challenges")
      .insert({
        user_id: userId,
        purpose,
        otp_hash: `${salt}:${otpHash}`,
        expires_at: new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (challengeErr || !challenge) {
      console.error("challenge insert error:", challengeErr);
      return error("STORE_FAILED", "Could not send code", 500);
    }

    // Send email via Resend
    const emailSent = await sendResendEmail({
      to: sendToEmail,
      recipientName,
      otp,
      purpose,
    });

    if (!emailSent) {
      // Clean up the challenge if email failed
      await adminClient.from("auth_otp_challenges").delete().eq("id", challenge.id);
      return error("EMAIL_FAILED", "Could not send verification email", 500);
    }

    const maskedEmail = maskEmail(sendToEmail);

    return json({ challengeId: challenge.id, sentTo: maskedEmail });
  } catch (err) {
    console.error("send-otp error:", err);
    return error("INTERNAL", "Something went wrong", 500);
  }
});

async function hashOtp(otp: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${otp}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendResendEmail({
  to,
  recipientName,
  otp,
  purpose,
}: {
  to: string;
  recipientName: string;
  otp: string;
  purpose: string;
}): Promise<boolean> {
  const subject =
    purpose === "signup"
      ? "Your StockRight Verification Code"
      : "StockRight Login Code";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1C1A16; margin-bottom: 8px;">Hi ${recipientName},</h2>
      <p style="color: #4A4237; margin-bottom: 24px;">Your StockRight verification code is:</p>
      <div style="background: #F5F0E8; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 0.15em; color: #1C1A16;">${otp}</span>
      </div>
      <p style="color: #7A6F61; font-size: 13px;">This code expires in 10 minutes.</p>
      <p style="color: #7A6F61; font-size: 13px;">If you didn't request this, ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #E5DED2; margin: 24px 0;" />
      <p style="color: #C0B8B0; font-size: 11px;">— StockRight Team</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
  });

  return res.ok;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: message, code }, status);
}
