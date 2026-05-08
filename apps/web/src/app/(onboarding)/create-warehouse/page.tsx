"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createWarehouse } from "@stockright/shared/api";
import { createWarehouseSchema } from "@stockright/shared/utils";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function CreateWarehousePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ warehouseName: "", location: "", capacityTonnes: "" });

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      warehouseName: form.warehouseName.trim(),
      location: form.location.trim() || undefined,
      capacityTonnes: form.capacityTonnes ? Number(form.capacityTonnes) : undefined,
    };
    const parsed = createWarehouseSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const client = getClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      await createWarehouse(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        session.access_token,
        parsed.data
      );
      router.push("/");
    } catch (err: unknown) {
      setErrors({ _form: (err as Error).message ?? "Failed to create warehouse. Try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-page)] px-4 py-12">
      <div className="mb-8">
        <Image src="/wordmark.svg" alt="StockRight" width={160} height={32} priority />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
            Set up your warehouse
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            You can add more warehouses later from settings
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-[var(--shadow-1)]"
        >
          <Input
            label="Warehouse Name"
            placeholder="Sri Balaji Cold Storage — Unit 1"
            value={form.warehouseName}
            onChange={(e) => setField("warehouseName", e.target.value)}
            error={errors.warehouseName}
            autoFocus
          />
          <Input
            label="Location"
            placeholder="Vijayawada, Andhra Pradesh"
            value={form.location}
            onChange={(e) => setField("location", e.target.value)}
            error={errors.location}
            helper="Optional — city or area"
          />
          <Input
            label="Total Capacity (MT)"
            type="number"
            placeholder="5000"
            value={form.capacityTonnes}
            onChange={(e) => setField("capacityTonnes", e.target.value)}
            error={errors.capacityTonnes}
            helper="Optional — metric tonnes"
          />
          {errors._form && (
            <p className="text-[13px] text-[var(--outward)] text-center">{errors._form}</p>
          )}
          <Button type="submit" full loading={isLoading} disabled={!form.warehouseName.trim()}>
            Create Warehouse
          </Button>
        </form>
      </div>

      <p className="mt-8 text-[12px] text-[var(--text-tertiary)] text-center">
        StockRight — Cold Storage Management
      </p>
    </div>
  );
}
