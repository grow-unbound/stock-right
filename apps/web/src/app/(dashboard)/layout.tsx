import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listWarehouses, fetchUserSessionContext } from "@stockright/shared/api";
import { ACTIVE_WAREHOUSE_COOKIE_NAME } from "@stockright/shared/utils";
import { AppShell } from "@/components/layout/AppShell";
import { SessionUserProvider } from "@/components/session/session-user-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const warehouses = await listWarehouses(supabase, user.id);
  const jar = await cookies();
  let active = jar.get(ACTIVE_WAREHOUSE_COOKIE_NAME)?.value ?? null;
  if (active && !warehouses.some((w) => w.id === active)) {
    active = null;
  }

  if (warehouses.length > 1 && !active) {
    redirect("/warehouse-select");
  }

  const effectiveWarehouseId = active ?? (warehouses.length === 1 ? warehouses[0]!.id : null);
  const context = await fetchUserSessionContext(supabase, effectiveWarehouseId);
  const canSwitchWarehouse = warehouses.length > 1;

  return (
    <SessionUserProvider value={{ context, canSwitchWarehouse }}>
      <AppShell>{children}</AppShell>
    </SessionUserProvider>
  );
}
