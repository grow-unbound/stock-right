"use client";

import type { StockMovementRow, StockSortColumn } from "@stockright/shared/stock-tab";
import { formatIndianCurrency } from "@stockright/shared/utils";
import { Badge } from "@/components/ui/Badge";
import {
  dataTableHeaderButtonClasses,
  dataTableTdAmount,
  dataTableTdBody,
  dataTableTdBodyMuted,
  dataTableTdCount,
  dataTableTdMono,
  dataTableTdPrimary,
} from "@/components/ui/data-table-classes";
import { TablePageSizeSelect } from "@/components/ui/table-page-size-select";
import { cn } from "@/lib/utils";

interface StockActivityTableProps {
  rows: StockMovementRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortColumn: StockSortColumn;
  sortDirection: "asc" | "desc";
  formatActivityDate: (isoDate: string) => string;
  movementLabel: (row: StockMovementRow) => string;
  formatStatus: (lotStatus: string) => string;
  formatBagCount: (n: number) => string;
  onSort: (column: StockSortColumn) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick?: (row: StockMovementRow) => void;
}

function SortGlyph({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </span>
  );
}

function lotStatusBadge(raw: string, formatStatus: (s: string) => string) {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "_");
  const label = formatStatus(raw);
  if (t === "ACTIVE") {
    return (
      <Badge variant="inward" className="normal-case tracking-normal">
        {label}
      </Badge>
    );
  }
  if (t === "STALE" || t === "DISPUTED") {
    return (
      <Badge variant="pending" className="normal-case tracking-normal">
        {label}
      </Badge>
    );
  }
  if (t === "WRITTEN_OFF") {
    return (
      <Badge variant="outward" className="normal-case tracking-normal">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className="normal-case tracking-normal">
      {label}
    </Badge>
  );
}

export function StockActivityTable({
  rows,
  totalCount,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  formatActivityDate,
  movementLabel,
  formatStatus,
  formatBagCount,
  onSort,
  onPageChange,
  onPageSizeChange,
  onRowClick,
}: StockActivityTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  function headerBtn(col: StockSortColumn, label: string, align: "left" | "right" | "center" = "left") {
    const active = sortColumn === col;
    return (
      <button type="button" onClick={() => onSort(col)} className={dataTableHeaderButtonClasses(align)}>
        {label}
        <SortGlyph active={active} dir={sortDirection} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <table className="w-full min-w-[1160px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--bg-subtle)]">
            <tr className="border-b border-[var(--border-default)]">
              <th className="min-w-[100px]">{headerBtn("tx_date", "Date")}</th>
              <th className="min-w-[120px]">{headerBtn("lot_number", "Lot number", "center")}</th>
              <th className="min-w-[120px]">{headerBtn("transaction_type", "Movement type")}</th>
              <th className="min-w-[104px]">{headerBtn("customer_code", "Customer code", "center")}</th>
              <th className="min-w-[140px]">{headerBtn("customer_name", "Customer name")}</th>
              <th className="min-w-[140px]">{headerBtn("product_name", "Product name")}</th>
              <th className="w-[104px]">{headerBtn("num_bags", "Num bags", "center")}</th>
              <th className="w-[116px]">{headerBtn("balance_bags", "Balance bags", "center")}</th>
              <th className="min-w-[100px]">{headerBtn("lot_status", "Status")}</th>
              <th className="min-w-[120px] text-right">{headerBtn("rent_pending", "Rent pending", "right")}</th>
              <th className="min-w-[128px] text-right">{headerBtn("charges_pending", "Charges pending", "right")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.transaction_type}-${row.event_id}`}
                className={cn(
                  "border-b border-[var(--border-default)] last:border-b-0",
                  onRowClick ? "cursor-pointer hover:bg-[var(--bg-subtle)]" : null
                )}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick ?
                    (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
                }
              >
                <td className={dataTableTdBodyMuted}>{formatActivityDate(row.tx_date)}</td>
                <td className={cn(dataTableTdMono, "max-w-[160px] truncate text-center")}>{row.lot_number}</td>
                <td className={cn(dataTableTdBody, "font-medium")}>{movementLabel(row)}</td>
                <td className={cn(dataTableTdMono, "max-w-[140px] truncate text-center")}>{row.customer_code}</td>
                <td className={cn(dataTableTdPrimary, "max-w-[200px] truncate")}>{row.customer_name}</td>
                <td className={cn(dataTableTdBody, "max-w-[220px] truncate")}>{row.product_name}</td>
                <td className={dataTableTdCount}>{formatBagCount(row.num_bags)}</td>
                <td className={dataTableTdCount}>{formatBagCount(row.balance_bags)}</td>
                <td className="px-3 py-2.5 align-middle">{lotStatusBadge(row.lot_status, formatStatus)}</td>
                <td className={dataTableTdAmount}>{formatIndianCurrency(row.rent_pending)}</td>
                <td className={dataTableTdAmount}>{formatIndianCurrency(row.charges_pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
          Showing {start}–{end} of {totalCount}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
            htmlFor="stock-table-page-size"
          >
            Rows per page
            <TablePageSizeSelect id="stock-table-page-size" value={pageSize} onChange={onPageSizeChange} />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className={cn(
                "min-h-[48px] rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-[14px] font-medium text-[var(--text-primary)] cursor-pointer",
                page <= 1 ? "opacity-40" : "hover:bg-[var(--bg-subtle)]"
              )}
            >
              Previous
            </button>
            <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className={cn(
                "min-h-[48px] rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-[14px] font-medium text-[var(--text-primary)] cursor-pointer",
                page >= totalPages ? "opacity-40" : "hover:bg-[var(--bg-subtle)]"
              )}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
