import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeIndiaPhoneDigits } from "../utils/phone-in";

/** One party code in the warehouse with canonical primary phone for picker UX. */
export interface PartyCodePickRow {
  customer_code: string;
  /** Value for `PhoneInput` / +91 UI (`+91` + 10 digits), or null if no primary phone on file. */
  phone: string | null;
  /** True when active rows under this code disagree on non-null primary phone. */
  phoneInconsistent: boolean;
}

function aggregateCodes(
  rows: readonly { customer_code: string; phone: string | null }[]
): PartyCodePickRow[] {
  type Acc = { nonNullNorms: Set<string> };
  const byCode = new Map<string, Acc>();

  for (const row of rows) {
    const code = row.customer_code;
    let acc = byCode.get(code);
    if (!acc) {
      acc = { nonNullNorms: new Set() };
      byCode.set(code, acc);
    }
    const raw = row.phone?.trim() ?? "";
    if (raw === "") continue;
    acc.nonNullNorms.add(normalizeIndiaPhoneDigits(raw));
  }

  const out: PartyCodePickRow[] = [];
  for (const [customer_code, acc] of byCode) {
    const inconsistent = acc.nonNullNorms.size > 1;
    let phone: string | null = null;
    if (!inconsistent && acc.nonNullNorms.size === 1) {
      const digits = [...acc.nonNullNorms][0];
      if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
        phone = `+91${digits}`;
      }
    }
    out.push({ customer_code, phone, phoneInconsistent: inconsistent });
  }

  out.sort((a, b) => a.customer_code.localeCompare(b.customer_code));
  return out;
}

/**
 * Distinct active party codes for a warehouse with canonical primary phone per code.
 * Used by Add Party code combobox. Aggregates in TS (bounded by warehouse customer count).
 */
export async function fetchDistinctPartyCodesForWarehouse(
  client: SupabaseClient,
  params: { warehouseId: string; q: string; limit: number }
): Promise<PartyCodePickRow[]> {
  const limit = Math.min(Math.max(params.limit, 1), 300);
  const needle = params.q.trim().toLowerCase();

  const { data, error } = await client
    .from("customers")
    .select("customer_code, phone")
    .eq("warehouse_id", params.warehouseId)
    .eq("is_active", true);

  if (error) throw error;

  let aggregated = aggregateCodes(data ?? []);

  if (needle.length > 0) {
    aggregated = aggregated.filter((r) => r.customer_code.toLowerCase().includes(needle));
  }

  return aggregated.slice(0, limit);
}

/** True when this warehouse already has at least one active row for the party code. */
export async function warehouseHasActiveCustomerCode(
  client: SupabaseClient,
  params: { warehouseId: string; customerCode: string }
): Promise<boolean> {
  const code = params.customerCode.trim();
  if (code === "") return false;
  const { data, error } = await client
    .from("customers")
    .select("id")
    .eq("warehouse_id", params.warehouseId)
    .eq("customer_code", code)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id !== undefined;
}

/** If primary phone is already used under another party code in this warehouse, return that code. */
export async function findActiveCustomerCodeOwningPrimaryPhone(
  client: SupabaseClient,
  params: { warehouseId: string; phoneRaw: string; excludeCustomerCode: string }
): Promise<string | null> {
  const norm = normalizeIndiaPhoneDigits(params.phoneRaw.trim());
  if (norm.length !== 10) return null;
  const exclude = params.excludeCustomerCode.trim();
  const { data, error } = await client
    .from("customers")
    .select("customer_code, phone")
    .eq("warehouse_id", params.warehouseId)
    .eq("is_active", true)
    .neq("customer_code", exclude);
  if (error) throw error;
  for (const row of data ?? []) {
    const praw = row.phone?.trim() ?? "";
    if (praw === "") continue;
    if (normalizeIndiaPhoneDigits(praw) === norm) {
      return row.customer_code;
    }
  }
  return null;
}
