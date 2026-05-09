import type { SupabaseClient } from "@supabase/supabase-js";

import { assertIndiaMobileOptional } from "../utils/phone-in";

export interface InsertCustomerParams {
  warehouseId: string;
  customerName: string;
  customerCode: string;
  phone: string;
  alternateMobile: string;
  address: string;
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

  const phone = params.phone.trim() === "" ? null : params.phone.trim();
  const mobile = params.alternateMobile.trim() === "" ? null : params.alternateMobile.trim();

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
    .maybeSingle();

  if (dupErr) throw dupErr;
  if (dupComposite) {
    throw new Error("A customer with this code and name already exists.");
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
