"use client";

import type { TenantUserRow } from "@stockright/shared/api";
import { roleLabel } from "@stockright/shared/utils";
import { Badge } from "@/components/ui/Badge";
import {
  dataTableHeaderStatic,
  dataTableTdBodyMuted,
  dataTableTdMono,
  dataTableTdPrimary,
} from "@/components/ui/data-table-classes";
import { cn } from "@/lib/utils";

interface TenantUsersTableProps {
  rows: TenantUserRow[];
  warehouseLabelById: Map<string, string>;
  onRowClick: (row: TenantUserRow) => void;
}

function warehousesSummary(row: TenantUserRow, warehouseLabelById: Map<string, string>): string {
  if (row.warehouseIds.length === 0) return "—";
  const labels = row.warehouseIds.map((id) => warehouseLabelById.get(id) ?? "—");
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function TenantUsersTable({ rows, warehouseLabelById, onRowClick }: TenantUsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-[var(--bg-subtle)]">
          <tr className="border-b border-[var(--border-default)]">
            <th className={cn(dataTableHeaderStatic, "min-w-[160px]")}>Name</th>
            <th className={cn(dataTableHeaderStatic, "min-w-[140px]")}>Phone</th>
            <th className={cn(dataTableHeaderStatic, "min-w-[180px]")}>Email</th>
            <th className={cn(dataTableHeaderStatic, "min-w-[120px]")}>Role</th>
            <th className={cn(dataTableHeaderStatic, "min-w-[200px]")}>Warehouses</th>
            <th className={cn(dataTableHeaderStatic, "w-[100px]")}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.userId}
              className={cn(
                "cursor-pointer border-b border-[var(--border-default)] last:border-b-0",
                "hover:bg-[var(--bg-subtle)] focus-within:bg-[var(--bg-subtle)]"
              )}
              tabIndex={0}
              role="button"
              onClick={() => onRowClick(row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              <td className={cn(dataTableTdPrimary, "max-w-[220px] truncate")}>
                {row.fullName?.trim() || row.phone}
              </td>
              <td className={cn(dataTableTdMono, "max-w-[160px] truncate")}>{row.phone}</td>
              <td className={cn(dataTableTdBodyMuted, "max-w-[220px] truncate")}>
                {row.email?.trim() ? row.email : "—"}
              </td>
              <td className={dataTableTdBodyMuted}>{roleLabel(row.role)}</td>
              <td className={cn(dataTableTdBodyMuted, "max-w-[260px]")}>
                {warehousesSummary(row, warehouseLabelById)}
              </td>
              <td className="px-3 py-2.5 align-middle">
                <Badge variant={row.isActive ? "online" : "pending"}>
                  {row.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
