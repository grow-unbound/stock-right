/** Two-letter initials for party avatars (supports Telugu/Latin mixed names). */
export function partyInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const w = parts[0];
    const chars = Array.from(w);
    return chars.length >= 2 ? `${chars[0]}${chars[1]}`.toUpperCase() : w.slice(0, 2).toUpperCase();
  }
  const a = Array.from(parts[0])[0] ?? "";
  const last = parts[parts.length - 1];
  const b = Array.from(last)[0] ?? "";
  return `${a}${b}`.toUpperCase();
}
