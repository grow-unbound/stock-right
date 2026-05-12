// Format phone for display: "+919876543210" → "+91 98765 43210"
export function formatPhone(phone: string): string {
  const digits = phone.replace(/^\+91/, "");
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

// Mask email for privacy display: "ravi@example.com" → "r***@example.com"
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

// Indian currency format: 247500 → "₹2,47,500"
export function formatIndianCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString("en-IN");
  return `₹${formatted}`;
}

/** Indian rupees with two fractional digits (e.g. 238.6 → ₹238.60). */
export function formatIndianCurrency2(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

// Indian number words: 250000 → "2.5 Lakh", 10000000 → "1 Crore"
export function formatIndianNumber(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Crore`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} Lakh`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Date format: always DD/MM/YYYY per brand spec
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** e.g. "12 Jan" — used on Money lists / compact activity rows */
export function formatMoneyListDate(iso: Date | string, locale = "en-IN"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
}

// Days since a date
export function daysOld(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}
