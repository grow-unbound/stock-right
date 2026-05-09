/** Normalize to digits only for Indian mobile comparison. */
export function normalizeIndiaPhoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

/** True if value is empty or looks like a valid Indian 10-digit mobile. */
export function isValidIndiaMobileOptional(raw: string): boolean {
  const t = raw.trim();
  if (t === "") return true;
  const d = normalizeIndiaPhoneDigits(t);
  return d.length === 10 && /^[6-9]\d{9}$/.test(d);
}

export function assertIndiaMobileOptional(raw: string, label: string): void {
  if (!isValidIndiaMobileOptional(raw)) {
    throw new Error(`${label} must be a valid 10-digit mobile number.`);
  }
}
