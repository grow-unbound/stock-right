"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { listTenantUsers, listWarehousesForTenant, type TenantUserRow } from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { useSessionUser } from "@/components/session/session-user-provider";
import { TenantUserForm } from "@/components/users/TenantUserForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UsersEditPage() {
  const router = useRouter();
  const params = useParams();
  const userId = typeof params?.userId === "string" ? params.userId : null;

  const { context } = useSessionUser();
  const tenantId = context?.tenantId ?? null;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [row, setRow] = useState<TenantUserRow | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [users, whs] = await Promise.all([
          listTenantUsers(supabase, tenantId),
          listWarehousesForTenant(supabase, tenantId),
        ]);
        if (cancelled) return;
        setWarehouses(whs);
        const found = users.find((u) => u.userId === userId) ?? null;
        setRow(found);
        if (!found) setError("User not found.");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, tenantId, userId]);

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
          Edit User
        </h1>
      </header>
      {tenantId && row ? (
        <TenantUserForm
          mode="edit"
          tenantId={tenantId}
          warehouses={warehouses}
          supabase={supabase}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
          initial={row}
          onClose={() => router.back()}
        />
      ) : null}
      {error ? <p className="p-4 text-[15px] text-[var(--outward)]">{error}</p> : null}
      {!tenantId ? (
        <p className="p-4 text-[15px] text-[var(--text-secondary)]">Select a warehouse first.</p>
      ) : null}
    </div>
  );
}
