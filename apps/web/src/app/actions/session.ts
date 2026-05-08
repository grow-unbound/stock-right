"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_WAREHOUSE_COOKIE_NAME } from "@stockright/shared/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

function warehouseCookieOptions() {
  return {
    path: "/" as const,
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 400,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function setActiveWarehouseIdAction(warehouseId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(warehouseId);
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("user_warehouse_assignments")
    .select("warehouse_id")
    .eq("user_id", user.id)
    .eq("warehouse_id", parsed.data)
    .maybeSingle();

  if (!row) return;

  const jar = await cookies();
  jar.set(ACTIVE_WAREHOUSE_COOKIE_NAME, parsed.data, warehouseCookieOptions());
  revalidatePath("/", "layout");
}

export async function clearActiveWarehouseCookieAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTIVE_WAREHOUSE_COOKIE_NAME);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(ACTIVE_WAREHOUSE_COOKIE_NAME);
  redirect("/login");
}
