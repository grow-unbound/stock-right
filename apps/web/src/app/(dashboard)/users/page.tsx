"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DesktopEntityTabSplit } from "@/components/dashboard/DesktopEntityTabSplit";
import { DesktopListPaneChrome } from "@/components/dashboard/DesktopListPaneChrome";
import { RegisterListRow } from "@/components/dashboard/RegisterListRow";
import { FormSidebar } from "@/components/money/add-receipt/FormSidebar";
import { TenantUserForm } from "@/components/users/TenantUserForm";
import { TenantUsersTable } from "@/components/users/TenantUsersTable";
import { Button } from "@/components/ui/Button";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

function DesktopUsersSplitSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-0">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-[var(--border-default)]">
        <div className="flex flex-col gap-2 border-b border-[var(--border-default)] p-2">
          <div className="h-12 skeleton rounded-[var(--radius-md)]" />
          <div className="h-8 skeleton rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex flex-col gap-2 p-2 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] skeleton rounded-[var(--radius-md)]" />
          ))}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 p-4">
        <div className="h-full min-h-[200px] skeleton rounded-[var(--radius-md)]" />
      </div>
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
  const [pane3Open, setPane3Open] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const desktopListScrollRef = useRef<HTMLDivElement>(null);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if ((panelMode === "create" || panelMode === "edit") && wide) {
      setPane3Open(true);
      if (panelMode === "create") setSelectedKey(null);
    }
  }, [panelMode, wide]);

  useEffect(() => {
    if (!pane3Open) return;
    if (!filteredRows.length) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && filteredRows.some((r) => r.userId === prev)) return prev;
      return filteredRows[0]!.userId;
    });
  }, [filteredRows, pane3Open]);

  const selectedRow = useMemo(
    () => filteredRows.find((r) => r.userId === selectedKey) ?? null,
    [filteredRows, selectedKey]
  );

  function scrollListToTop() {
    if (desktopListScrollRef.current) desktopListScrollRef.current.scrollTop = 0;
    if (listScrollContainerRef.current) listScrollContainerRef.current.scrollTop = 0;
    if (!wide) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openCreatePanel() {
    setEditRow(null);
    setPanelMode("create");
    setPane3Open(true);
    setSelectedKey(null);
  }

  function openEditPanel(row: TenantUserRow) {
    setEditRow(row);
    setPanelMode("edit");
    setSelectedKey(row.userId);
    setPane3Open(true);
  }

  function closePanel() {
    setPanelMode("closed");
    setEditRow(null);
    scrollListToTop();
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
  const showEmptyNoUsers = Boolean(tenantId) && !loading && !error && rows.length === 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const formOpen = panelMode === "create" || panelMode === "edit";

  const listBlockDesktop = () => {
    if (!pane3Open && !loading && tenantId) {
      if (showEmpty) {
        return (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
          </div>
        );
      }
      if (showEmptyNoUsers) {
        return (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] py-12">
            <UserCog className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <p className="text-[15px] text-[var(--text-secondary)]">No teammates yet.</p>
            <Button type="button" className="min-h-[48px]" disabled={offline} onClick={() => openCreatePanel()}>
              Add user
            </Button>
          </div>
        );
      }
      return (
        <TenantUsersTable
          rows={filteredRows}
          warehouseLabelById={warehouseLabelById}
          onRowClick={(row) => {
            setSelectedKey(row.userId);
            setPanelMode("closed");
            setEditRow(null);
            setPane3Open(true);
          }}
        />
      );
    }

    if (loading) return <UsersListSkeleton />;
    if (showEmpty) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
          <SearchX className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          <p className="text-[15px] text-[var(--text-secondary)]">No matches. Try a different search or filter.</p>
        </div>
      );
    }
    if (showEmptyNoUsers) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] py-12">
          <UserCog className="size-10 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          <p className="text-[15px] text-[var(--text-secondary)]">No teammates yet.</p>
          <Button type="button" className="min-h-[48px]" disabled={offline} onClick={() => openCreatePanel()}>
            Add user
          </Button>
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-2">
        {filteredRows.map((row) => (
          <li key={row.userId}>
            <RegisterListRow
              as="button"
              selected={wide && !formOpen && selectedKey === row.userId}
              onClick={() => {
                setSelectedKey(row.userId);
                setPanelMode("closed");
                setEditRow(null);
                if (!pane3Open) setPane3Open(true);
              }}
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
    );
  };

  const detailsBody = () => {
    if (panelMode === "create" && tenantId && supabaseUrl) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TenantUserForm
            key="create"
            mode="create"
            layoutVariant="detailPane"
            title="Add user"
            tenantId={tenantId}
            warehouses={warehouses}
            supabase={supabase}
            supabaseUrl={supabaseUrl}
            onClose={closePanel}
          />
        </div>
      );
    }
    if (panelMode === "edit" && tenantId && supabaseUrl && editRow) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TenantUserForm
            key={editRow.userId}
            mode="edit"
            layoutVariant="detailPane"
            title="Edit user"
            tenantId={tenantId}
            warehouses={warehouses}
            supabase={supabase}
            supabaseUrl={supabaseUrl}
            initial={editRow}
            onClose={closePanel}
          />
        </div>
      );
    }
    if (!selectedRow) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 bg-[var(--bg-page)] px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
              Details
            </h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto p-4 pr-3">
            <div className="flex min-h-[200px] flex-col justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center">
              <p className="text-[15px] text-[var(--text-secondary)]">Select a teammate to see details.</p>
            </div>
          </div>
        </div>
      );
    }
    const displayTitle = selectedRow.fullName?.trim() || selectedRow.phone;
    const whLabels = selectedRow.warehouseIds.map((id) => warehouseLabelById.get(id) ?? id).join(", ");
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-[1] shrink-0 bg-[var(--bg-page)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {displayTitle}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-3 pt-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Teammate</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{roleLabel(selectedRow.role)}</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{selectedRow.email?.trim() || "—"}</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{selectedRow.phone}</p>
            <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
              {selectedRow.isActive ? "Active" : "Inactive"}
            </p>
            {whLabels ? (
              <p className="mt-3 text-[13px] text-[var(--text-secondary)]">Warehouses: {whLabels}</p>
            ) : null}
            <Button
              type="button"
              className="mt-4 min-h-[48px] w-full sm:w-auto"
              disabled={offline}
              onClick={() => openEditPanel(selectedRow)}
            >
              Edit user
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardPageShell
      title="Users & Roles"
      chromeVariant="titleOnly"
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
      <div className="flex min-h-0 flex-1 flex-col px-0 sm:min-h-0 sm:overflow-hidden">
        <p className="pt-4 text-[14px] text-[var(--text-secondary)] sm:pt-0">
          People who can sign in for this organization.
        </p>

        {!tenantId ? (
          <p className="pt-2 text-[15px] text-[var(--text-secondary)]">Select a warehouse first.</p>
        ) : null}

        {tenantId && offline ? (
          <p className="pt-2 text-[13px] text-[var(--text-secondary)]">
            You are offline. Connect to add or edit users.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-[15px] text-[var(--outward)]">{error}</p>
            <Button type="button" variant="secondary" className="mt-3 min-h-[48px]" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {tenantId && !error ? (
          <>
            <div ref={listScrollContainerRef} className="flex min-h-0 flex-1 flex-col pt-4 sm:hidden">
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

            <div className="hidden min-h-0 flex-1 flex-col overflow-hidden sm:flex">
              {loading ? (
                <DesktopUsersSplitSkeleton />
              ) : (
                <DesktopEntityTabSplit
                  detailsOpen={pane3Open}
                  list={
                    <>
                      <DesktopListPaneChrome
                        searchPlaceholder={USERS_SEARCH_PLACEHOLDER}
                        searchValue={searchInput}
                        onSearchChange={setSearchInput}
                        chips={USERS_FILTER_CHIPS}
                        chipActiveId={filterId}
                        onChipChange={(id) => {
                          if (isUsersFilterId(id)) setFilterId(id);
                        }}
                        detailsOpen={pane3Open}
                        onToggleDetails={() => setPane3Open((v) => !v)}
                      />
                      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div
                          ref={desktopListScrollRef}
                          className="relative z-0 min-h-0 flex-1 overflow-y-auto pb-3 pr-4 pt-2"
                        >
                          {listBlockDesktop()}
                        </div>
                        {formOpen ? (
                          <div
                            className="pointer-events-auto absolute inset-0 z-[1] bg-[var(--bg-page)]/60"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    </>
                  }
                  details={
                    <div
                      className={cn(
                        "sr-side-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-page)] pl-4 pt-1",
                        pane3Open ? "sr-side-fade-in" : "sr-side-fade-out"
                      )}
                    >
                      {detailsBody()}
                    </div>
                  }
                />
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
          !wide &&
          (panelMode === "create" || (panelMode === "edit" && editRow !== null))
        }
        title={panelMode === "create" ? "Add User" : "Edit User"}
        onClose={closePanel}
      >
        {tenantId && supabaseUrl ? (
          <TenantUserForm
            key={panelMode === "edit" ? editRow?.userId ?? "edit" : "create"}
            mode={panelMode === "create" ? "create" : "edit"}
            layoutVariant="sidebar"
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
