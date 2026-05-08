import type { UserRole } from "../types/models";

export function initialsFromDisplayName(displayName: string | null, phone: string): string {
  const trimmed = displayName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-2).padStart(2, "0") || "??";
}

export function roleLabel(role: UserRole | null): string {
  if (!role) return "—";
  if (role === "OWNER") return "Owner";
  if (role === "MANAGER") return "Manager";
  return "Staff";
}
