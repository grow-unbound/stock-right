import type { SupabaseClient } from "@supabase/supabase-js";

import { assertIndiaMobileOptional, normalizeIndiaPhoneDigits } from "../utils/phone-in";

export interface InsertCustomerParams {
  warehouseId: string;
  customerName: string;
  customerCode: string;
  phone: string;
  alternateMobile: string;
  address: string;
}

/** Persist 10-digit India mobile; null if empty or not normalizable to 10 digits. */
function primaryPhoneForStorage(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const d = normalizeIndiaPhoneDigits(t);
  return d.length === 10 && /^[6-9]\d{9}$/.test(d) ? d : null;
}

function alternatePhoneForStorage(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const d = normalizeIndiaPhoneDigits(t);
  return d.length === 10 && /^[6-9]\d{9}$/.test(d) ? d : null;
}

export async function insertCustomer(
  client: SupabaseClient,
  params: InsertCustomerParams
): Promise<{ id: string }> {
  const customerName = params.customerName.trim();
  const customerCode = params.customerCode.trim();
  if (customerName === "" || customerCode === "") {
    throw new Error("Customer name and code are required.");
  }

  assertIndiaMobileOptional(params.phone, "Phone number");
  assertIndiaMobileOptional(params.alternateMobile, "Alternate mobile");

  const phone = primaryPhoneForStorage(params.phone);
  const mobile = alternatePhoneForStorage(params.alternateMobile);

  const { data: wh, error: whErr } = await client
    .from("warehouses")
    .select("tenant_id")
    .eq("id", params.warehouseId)
    .maybeSingle();

  if (whErr) throw whErr;
  if (!wh?.tenant_id) throw new Error("Warehouse not found or not accessible.");

  const { data: dupComposite, error: dupErr } = await client
    .from("customers")
    .select("id")
    .eq("warehouse_id", params.warehouseId)
    .eq("customer_code", customerCode)
    .eq("customer_name", customerName)
    .eq("is_active", true)
    .maybeSingle();

  if (dupErr) throw dupErr;
  if (dupComposite) {
    throw new Error("A customer with this code and name already exists.");
  }

  if (phone) {
    const norm = normalizeIndiaPhoneDigits(phone);
    const { data: peers, error: peersErr } = await client
      .from("customers")
      .select("phone")
      .eq("warehouse_id", params.warehouseId)
      .eq("customer_code", customerCode);

    if (peersErr) throw peersErr;
    const peerNorms = new Set<string>();
    for (const p of peers ?? []) {
      const praw = p.phone?.trim() ?? "";
      if (praw === "") continue;
      peerNorms.add(normalizeIndiaPhoneDigits(praw));
    }
    if (peerNorms.size > 1) {
      throw new Error(
        "This party code has different phone numbers on file. Fix existing data before adding another name."
      );
    }
    if (peerNorms.size === 1) {
      const established = [...peerNorms][0];
      if (norm !== established) {
        throw new Error("This phone does not match the number already used for this party code.");
      }
    }

    const { data: otherRows, error: otherErr } = await client
      .from("customers")
      .select("customer_code, phone")
      .eq("warehouse_id", params.warehouseId)
      .neq("customer_code", customerCode);

    if (otherErr) throw otherErr;
    for (const row of otherRows ?? []) {
      const prow = row.phone?.trim() ?? "";
      if (prow === "") continue;
      if (normalizeIndiaPhoneDigits(prow) === norm) {
        throw new Error(`Phone number is already set up for ${row.customer_code}.`);
      }
    }
  } else {
    const { data: peersForPhone, error: pfpErr } = await client
      .from("customers")
      .select("phone")
      .eq("warehouse_id", params.warehouseId)
      .eq("customer_code", customerCode);

    if (pfpErr) throw pfpErr;
    const anyPeerHasPhone = (peersForPhone ?? []).some((p) => (p.phone?.trim() ?? "") !== "");
    if (anyPeerHasPhone) {
      throw new Error("This party code already has a phone on file. Enter the same number.");
    }
  }

  const { data, error } = await client
    .from("customers")
    .insert({
      warehouse_id: params.warehouseId,
      tenant_id: wh.tenant_id,
      customer_name: customerName,
      customer_code: customerCode,
      phone,
      mobile,
      address: params.address.trim() === "" ? null : params.address.trim(),
      category: "TRADER",
      credit_limit: 0,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Customer insert returned no id.");
  return { id: data.id };
}
