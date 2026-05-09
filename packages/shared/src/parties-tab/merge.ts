import type { PartiesTabListRow } from "./schemas";
import { partyRowKey } from "./schemas";

export function mergeUniquePartyRows(base: PartiesTabListRow[], incoming: PartiesTabListRow[]): PartiesTabListRow[] {
  const map = new Map<string, PartiesTabListRow>();
  for (const row of base) map.set(partyRowKey(row), row);
  for (const row of incoming) map.set(partyRowKey(row), row);
  return [...map.values()];
}
