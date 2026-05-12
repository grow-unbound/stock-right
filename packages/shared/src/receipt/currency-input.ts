/** Parse user-typed Indian rupee field (may include ₹, commas, spaces). */
export function parseIndianRupeeInput(raw: string): number | null {
  const cleaned = raw.replace(/₹/g, "").replace(/\s/g, "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "-") return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Format number for controlled input (no currency symbol); drops ".00" for whole rupees. */
export function formatRupeeDigitsForInput(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const [intPart, frac] = amount.toFixed(2).split(".");
  const withGrouping = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === "00" ? withGrouping : `${withGrouping}.${frac}`;
}

/** Same as {@link formatRupeeDigitsForInput} but always keeps two fractional digits. */
export function formatRupeeDigitsForInput2(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const [intPart, frac] = amount.toFixed(2).split(".");
  const withGrouping = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withGrouping}.${frac}`;
}

/** Indian-style grouping while typing (digits + optional decimal, max 2 fractional digits). */
export function formatRupeeInputLive(raw: string): string {
  const cleaned = raw.replace(/₹/g, "").replace(/\s/g, "").replace(/,/g, "");
  if (cleaned === "") return "";
  const hasDot = cleaned.includes(".");
  const [intRaw, ...fracParts] = cleaned.split(".");
  const intDigits = intRaw.replace(/\D/g, "");
  const fracDigits = fracParts.join("").replace(/\D/g, "").slice(0, 2);
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (hasDot) {
    return fracDigits.length > 0 ? `${grouped}.${fracDigits}` : `${grouped}.`;
  }
  return grouped;
}
