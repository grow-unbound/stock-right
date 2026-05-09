"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSessionUser } from "@/components/session/session-user-provider";
import { AddReceiptForm } from "@/components/money/add-receipt/AddReceiptForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MoneyReceiptNewPage() {
  const router = useRouter();
  const { context } = useSessionUser();
  const warehouseId = context?.warehouseId ?? null;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

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
          Add Receipt
        </h1>
      </header>
      {warehouseId ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AddReceiptForm
            variant="fullscreen"
            warehouseId={warehouseId}
            supabase={supabase}
            onClose={() => router.back()}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent("sr-money-refresh"));
            }}
          />
        </div>
      ) : (
        <p className="p-4 text-[15px] text-[var(--text-secondary)]">Select a warehouse first.</p>
      )}
    </div>
  );
}
