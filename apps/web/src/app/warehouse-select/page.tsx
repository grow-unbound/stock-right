"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { listWarehouses } from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function WarehouseSelectPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const client = getClient();
    client.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      listWarehouses(client, data.user.id)
        .then(setWarehouses)
        .catch((err: unknown) => setError((err as Error).message ?? "Failed to load warehouses."))
        .finally(() => setIsLoading(false));
    });
  }, [router]);

  function handleSelect(warehouseId: string) {
    setSelecting(warehouseId);
    localStorage.setItem("active_warehouse_id", warehouseId);
    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-page)] px-4 py-12">
      <div className="mb-8">
        <Image src="/wordmark.svg" alt="StockRight" width={160} height={32} priority />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Select warehouse</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Choose which warehouse to open</p>
        </div>

        <div className="space-y-3">
          {isLoading && (
            <>{[1, 2].map((i) => (
              <div key={i} className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 h-20 skeleton" />
            ))}</>
          )}

          {!isLoading && error && (
            <p className="text-center text-[13px] text-[var(--outward)]">{error}</p>
          )}

          {!isLoading && !error && warehouses.map((wh) => (
            <button
              key={wh.id}
              type="button"
              onClick={() => handleSelect(wh.id)}
              disabled={!!selecting}
              className="w-full text-left rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-1)] transition-all duration-[var(--duration-fast)] hover:border-[var(--brand-ui)] hover:shadow-[var(--shadow-2)] focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)] disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--inward-bg)] flex items-center justify-center flex-shrink-0">
                  <WarehouseIcon size={20} className="text-[var(--inward)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{wh.warehouseName}</p>
                  {wh.city && (
                    <p className="text-[13px] text-[var(--text-secondary)] truncate">
                      {[wh.city, wh.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                {selecting === wh.id && (
                  <div className="ml-auto w-4 h-4 border-2 border-[var(--brand-ui)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-[12px] text-[var(--text-tertiary)] text-center">
        StockRight — Cold Storage Management
      </p>
    </div>
  );
}
