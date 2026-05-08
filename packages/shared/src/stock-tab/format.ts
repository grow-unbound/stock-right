export function formatStockActivityDate(txDate: string): string {
  const d = new Date(`${txDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return txDate;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatLotStatusLabel(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "_");
  switch (t) {
    case "ACTIVE":
      return "Active";
    case "STALE":
      return "Stale";
    case "DELIVERED":
      return "Delivered";
    case "CLEARED":
      return "Cleared";
    case "WRITTEN_OFF":
      return "Written off";
    case "DISPUTED":
      return "Disputed";
    default:
      if (raw.trim().length === 0) return "—";
      return raw
        .trim()
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());
  }
}
