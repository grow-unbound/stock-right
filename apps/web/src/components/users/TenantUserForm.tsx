"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { TenantUserRow } from "@stockright/shared/api";
import {
  createTenantUser,
  TENANT_USERS_REFRESH_EVENT,
  updateTenantUser,
} from "@stockright/shared/api";
import type { Warehouse } from "@stockright/shared/types";
import {
  createTenantUserInputSchema,
  roleLabel,
  updateTenantUserInputSchema,
} from "@stockright/shared/utils";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const labelClass =
  "mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]";
const inputClass =
  "min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]";

interface TenantUserFormProps {
  mode: "create" | "edit";
  layoutVariant?: "sidebar" | "detailPane";
  title?: string;
  tenantId: string;
  warehouses: Warehouse[];
  supabase: SupabaseClient;
  supabaseUrl: string;
  initial?: TenantUserRow;
  onClose: () => void;
}

export function TenantUserForm({
  mode,
  layoutVariant = "sidebar",
  title,
  tenantId,
  warehouses,
  supabase,
  supabaseUrl,
  initial,
  onClose,
}: TenantUserFormProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<"MANAGER" | "STAFF">(
    initial?.role === "MANAGER" || initial?.role === "STAFF" ? initial.role : "STAFF"
  );
  const [statusActive, setStatusActive] = useState(initial?.isActive ?? true);
  const [selectedWarehouses, setSelectedWarehouses] = useState<Set<string>>(
    () => new Set(initial?.warehouseIds ?? [])
  );

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isOwnerTarget = initial?.role === "OWNER";

  const warehouseNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.warehouseName);
    return m;
  }, [warehouses]);

  function toggleWarehouse(id: string) {
    setSelectedWarehouses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const warehouseIds = [...selectedWarehouses];

    if (mode === "create") {
      const parsed = createTenantUserInputSchema.safeParse({
        tenantId,
        fullName: fullName.trim(),
        phone,
        email: email.trim(),
        warehouseIds,
        role,
      });
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.errors.forEach((er) => {
          const k = er.path[0];
          if (typeof k === "string" && !fe[k]) fe[k] = er.message;
        });
        setErrors(fe);
        return;
      }

      setSubmitting(true);
      try {
        await createTenantUser(supabase, supabaseUrl, parsed.data);
        window.dispatchEvent(new CustomEvent(TENANT_USERS_REFRESH_EVENT));
        toast.success("User added.");
        onClose();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Could not create user.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!initial) return;

    const patch: Record<string, unknown> = {
      tenantId,
      userId: initial.userId,
      fullName: fullName.trim(),
      phone,
      email: email.trim().toLowerCase(),
      isActive: statusActive,
      warehouseIds,
    };
    if (!isOwnerTarget) {
      patch.role = role;
    }

    const parsed = updateTenantUserInputSchema.safeParse(patch);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.errors.forEach((er) => {
        const k = er.path[0];
        if (typeof k === "string" && !fe[k]) fe[k] = er.message;
      });
      setErrors(fe);
      return;
    }

    setSubmitting(true);
    try {
      await updateTenantUser(supabase, supabaseUrl, parsed.data);
      window.dispatchEvent(new CustomEvent(TENANT_USERS_REFRESH_EVENT));
      toast.success("Saved.");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  const formTitle = title ?? (mode === "create" ? "Add user" : "Edit user");

  const fieldList = (
    <>
      <div>
        <label htmlFor="tu-full-name" className={labelClass}>
          Full Name
        </label>
        <Input
          id="tu-full-name"
          value={fullName}
          onChange={(ev) => setFullName(ev.target.value)}
          className={inputClass}
          autoComplete="name"
        />
        {errors.fullName && (
          <p className="mt-1 text-[12px] text-[var(--outward)]">{errors.fullName}</p>
        )}
      </div>

      <PhoneInput value={phone} onChange={setPhone} error={errors.phone} />

      <div>
        <label htmlFor="tu-email" className={labelClass}>
          Email
        </label>
        <Input
          id="tu-email"
          type="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={inputClass}
          autoComplete="email"
        />
        {errors.email && (
          <p className="mt-1 text-[12px] text-[var(--outward)]">{errors.email}</p>
        )}
      </div>

      {mode === "edit" && isOwnerTarget ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">Role</p>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{roleLabel("OWNER")}</p>
        </div>
      ) : (
        <div>
          <span className={labelClass}>Role</span>
          <Select value={role} onValueChange={(v) => setRole(v as "MANAGER" | "STAFF")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANAGER">{roleLabel("MANAGER")}</SelectItem>
              <SelectItem value="STAFF">{roleLabel("STAFF")}</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p className="mt-1 text-[12px] text-[var(--outward)]">{errors.role}</p>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div>
          <span className={labelClass}>Status</span>
          <Select
            value={statusActive ? "ACTIVE" : "INACTIVE"}
            onValueChange={(v) => setStatusActive(v === "ACTIVE")}
            disabled={isOwnerTarget}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {isOwnerTarget ? (
            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
              Owner accounts cannot be marked inactive here.
            </p>
          ) : null}
        </div>
      )}

      <fieldset className={cn("min-w-0", layoutVariant === "detailPane" && "lg:col-span-2")}>
        <legend className={`${labelClass} mb-2 px-0`}>Warehouses</legend>
        <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
          {warehouses.map((w) => (
            <label
              key={w.id}
              className="flex min-h-[48px] cursor-pointer items-center gap-3 text-[15px] text-[var(--text-primary)]"
            >
              <input
                type="checkbox"
                checked={selectedWarehouses.has(w.id)}
                onChange={() => toggleWarehouse(w.id)}
                className="size-4 shrink-0 rounded border-[var(--border-default)] accent-[var(--brand-ui)]"
              />
              <span className="min-w-0">{warehouseNames.get(w.id) ?? w.warehouseName}</span>
            </label>
          ))}
        </div>
        {errors.warehouseIds && (
          <p className="mt-1 text-[12px] text-[var(--outward)]">{errors.warehouseIds}</p>
        )}
      </fieldset>
    </>
  );

  const footerActions = (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] sm:flex-row sm:justify-end sm:gap-2",
        layoutVariant === "detailPane" ?
          "px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3"
        : "pt-4 mt-auto"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="min-h-[48px] w-full min-w-[var(--cta-tab-min-width)] justify-center sm:w-auto sm:shrink-0"
        onClick={onClose}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={submitting}
        className="min-h-[48px] w-full min-w-[var(--cta-tab-min-width)] justify-center sm:w-auto sm:shrink-0"
      >
        {submitting ? (mode === "create" ? "Adding…" : "Saving…") : mode === "create" ? "Add user" : "Save"}
      </Button>
    </div>
  );

  if (layoutVariant === "detailPane") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="sticky top-0 z-[1] flex shrink-0 items-center justify-between bg-[var(--bg-page)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {formTitle}
          </h2>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            onClick={onClose}
            aria-label="Close form"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-6">{fieldList}</div>
          </div>
          {footerActions}
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {fieldList}
      {footerActions}
    </form>
  );
}
