"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { listWarehousesForTenant } from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { useSessionUser } from "@/components/session/session-user-provider";
import { TenantUserForm } from "@/components/users/TenantUserForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UsersNewPage() {
  const router = useRouter();
  const { context } = useSessionUser();
  const tenantId = context?.tenantId ?? null;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWarehousesForTenant(supabase, tenantId);
        if (!cancelled) setWarehouses(list);
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load warehouses.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, tenantId]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--bg-page)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-1 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-1 py-1 sm:px-2">
        <button
          type="button"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          onClick={() => router.back()}
        >
          <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
          Add User
        </h1>
      </header>
      {tenantId && !loadError ? (
        <TenantUserForm
          mode="create"
          tenantId={tenantId}
          warehouses={warehouses}
          supabase={supabase}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
          onClose={() => router.back()}
        />
      ) : null}
      {!tenantId ? (
        <p className="p-4 text-[15px] text-[var(--text-secondary)]">Select a warehouse first.</p>
      ) : null}
      {loadError ? (
        <p className="p-4 text-[15px] text-[var(--outward)]">{loadError}</p>
      ) : null}
    </div>
  );
}
