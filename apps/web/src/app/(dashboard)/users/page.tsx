"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchX, UserCog } from "lucide-react";
import type { LandingFilterChip } from "@stockright/shared/demo";
import {
  listTenantUsers,
  listWarehousesForTenant,
  TENANT_USERS_REFRESH_EVENT,
  type TenantUserRow,
} from "@stockright/shared/api";
import { roleLabel } from "@stockright/shared/utils";
import type { Warehouse } from "@stockright/shared/types";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { TenantUserForm } from "@/components/users/TenantUserForm";
import { TenantUsersTable } from "@/components/users/TenantUsersTable";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STROKE = 2;

const USERS_SEARCH_PLACEHOLDER = "Search by name, phone, or email";

const USERS_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

type UsersFilterId = "all" | "active" | "inactive";

function isUsersFilterId(id: string): id is UsersFilterId {
  return id === "all" || id === "active" || id === "inactive";
}

function applyUsersFilters(rows: TenantUserRow[], filterId: UsersFilterId, searchRaw: string): TenantUserRow[] {
  let out = rows;
  if (filterId === "active") out = out.filter((r) => r.isActive);
  if (filterId === "inactive") out = out.filter((r) => !r.isActive);
  const q = searchRaw.trim().toLowerCase();
  if (!q) return out;
  return out.filter((r) => {
    const name = (r.fullName ?? "").toLowerCase();
    const phone = r.phone.toLowerCase();
    const email = (r.email ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q) || email.includes(q);
  });
}

function UsersListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="h-[72px] skeleton rounded-[var(--radius-md)]" />
      ))}
    </ul>
  );
}

function DesktopTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="min-h-[200px] skeleton rounded-[var(--radius-md)]" />
    </div>
  );
}

type PanelMode = "closed" | "create" | "edit";

export default function UsersPage() {
  const router = useRouter();
  const { context } = useSessionUser();
  const tenantId = context?.tenantId ?? null;
  const offline = useIsOffline();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [wide, setWide] = useState(false);
  const [rows, setRows] = useState<TenantUserRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [filterId, setFilterId] = useState<UsersFilterId>("all");

  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [editRow, setEditRow] = useState<TenantUserRow | null>(null);

  const filteredRows = useMemo(
    () => applyUsersFilters(rows, filterId, searchInput),
    [rows, filterId, searchInput]
  );

  const warehouseLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.warehouseName);
    return m;
  }, [warehouses]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    setLoading(true);
    try {
      const [list, whs] = await Promise.all([
        listTenantUsers(supabase, tenantId),
        listWarehousesForTenant(supabase, tenantId),
      ]);
      setRows(list);
      setWarehouses(whs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [supabase, tenantId]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      void load();
    }
    window.addEventListener(TENANT_USERS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(TENANT_USERS_REFRESH_EVENT, onRefresh);
  }, [load]);

  function openCreatePanel() {
    setEditRow(null);
    setPanelMode("create");
  }

  function openEditPanel(row: TenantUserRow) {
    setEditRow(row);
    setPanelMode("edit");
  }

  function closePanel() {
    setPanelMode("closed");
    setEditRow(null);
  }

  const desktopActions = (
    <Button
      variant="primary"
      size="sm"
      type="button"
      className="min-w-[var(--cta-tab-min-width)] justify-center"
      disabled={!tenantId || offline}
      onClick={() => {
        if (wide) {
          openCreatePanel();
        } else {
          router.push("/users/new");
        }
      }}
    >
      Add user
    </Button>
  );

  const showEmpty =
    Boolean(tenantId) && !loading && !error && filteredRows.length === 0 && rows.length > 0;
  const showEmptyNoUsers =
    Boolean(tenantId) && !loading && !error && rows.length === 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <DashboardPageShell
      title="Users & Roles"
      searchPlaceholder={USERS_SEARCH_PLACEHOLDER}
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      chips={USERS_FILTER_CHIPS}
      chipActiveId={filterId}
      onChipChange={(id) => {
        if (isUsersFilterId(id)) setFilterId(id);
      }}
      desktopActions={desktopActions}
      fabActionOnSelect={(id) => {
        if (id !== "add_user") return;
        if (wide) {
          openCreatePanel();
        } else {
          router.push("/users/new");
        }
      }}
    >
      <div className="flex flex-col gap-4 px-0 pt-4">
        <p className="text-[14px] text-[var(--text-secondary)]">
          People who can sign in for this organization.
        </p>

        {!tenantId ? (
          <p className="text-[15px] text-[var(--text-secondary)]">Select a warehouse first.</p>
        ) : null}

        {tenantId && offline ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            You are offline. Connect to add or edit users.
          </p>
        ) : null}

        {error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-[15px] text-[var(--outward)]">{error}</p>
            <Button type="button" variant="secondary" className="mt-3 min-h-[48px]" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {tenantId && !error ? (
          <>
            <div className="hidden sm:block">
              {loading ? (
                <DesktopTableSkeleton />
              ) : showEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : showEmptyNoUsers ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] py-12">
                  <UserCog className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">No teammates yet.</p>
                  <Button
                    type="button"
                    className="min-h-[48px]"
                    disabled={offline}
                    onClick={() => openCreatePanel()}
                  >
                    Add user
                  </Button>
                </div>
              ) : (
                <TenantUsersTable
                  rows={filteredRows}
                  warehouseLabelById={warehouseLabelById}
                  onRowClick={openEditPanel}
                />
              )}
            </div>

            <div className="sm:hidden">
              {loading ? (
                <UsersListSkeleton />
              ) : showEmpty ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
                  <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">
                    No matches. Try a different search or filter.
                  </p>
                </div>
              ) : showEmptyNoUsers ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] py-12">
                  <UserCog className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                  <p className="text-[15px] text-[var(--text-secondary)]">No teammates yet.</p>
                  <Button
                    type="button"
                    className="min-h-[48px]"
                    disabled={offline}
                    onClick={() => router.push("/users/new")}
                  >
                    Add user
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredRows.map((row) => (
                    <li key={row.userId}>
                      <RegisterListRow
                        as="button"
                        onClick={() => router.push(`/users/${row.userId}`)}
                        icon={<UserCog className="size-[18px]" strokeWidth={STROKE} aria-hidden />}
                        iconShellClassName="bg-[var(--brand-subtle)] text-[var(--brand-text)]"
                        meta={roleLabel(row.role)}
                        title={row.fullName?.trim() || row.phone}
                        detail={
                          <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                            {row.email?.trim() ? row.email : row.phone}
                          </span>
                        }
                        trailing={
                          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>

      <FormSidebar
        open={
          panelMode !== "closed" &&
          Boolean(tenantId) &&
          !offline &&
          Boolean(supabaseUrl) &&
          (panelMode === "create" || (panelMode === "edit" && editRow !== null))
        }
        title={panelMode === "create" ? "Add User" : "Edit User"}
        onClose={closePanel}
      >
        {tenantId && supabaseUrl ? (
          <TenantUserForm
            key={panelMode === "edit" ? editRow?.userId ?? "edit" : "create"}
            mode={panelMode === "create" ? "create" : "edit"}
            tenantId={tenantId}
            warehouses={warehouses}
            supabase={supabase}
            supabaseUrl={supabaseUrl}
            initial={panelMode === "edit" ? editRow ?? undefined : undefined}
            onClose={closePanel}
          />
        ) : null}
      </FormSidebar>
    </DashboardPageShell>
  );
}
