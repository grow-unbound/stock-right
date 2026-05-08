"use client";

import type { StockMovementRow, StockSortColumn } from "@stockright/shared/stock-tab";
import { formatIndianCurrency } from "@stockright/shared/utils";
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
}

const cell = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-primary)]";
const cellMuted = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-secondary)]";
const cellMono = "px-3 py-2.5 font-[family-name:var(--font-mono)] text-[15px] font-normal tabular-nums text-[var(--text-primary)]";

function SortGlyph({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </span>
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
}: StockActivityTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  function headerBtn(col: StockSortColumn, label: string, align: "left" | "right" = "left") {
    const active = sortColumn === col;
    return (
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "flex min-h-[48px] w-full items-center px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          align === "right" && "justify-end text-right"
        )}
      >
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
              <th className="min-w-[120px]">{headerBtn("lot_number", "Lot number")}</th>
              <th className="min-w-[120px]">{headerBtn("transaction_type", "Movement type")}</th>
              <th className="min-w-[104px]">{headerBtn("customer_code", "Customer code")}</th>
              <th className="min-w-[140px]">{headerBtn("customer_name", "Customer name")}</th>
              <th className="min-w-[140px]">{headerBtn("product_name", "Product name")}</th>
              <th className="w-[104px]">{headerBtn("num_bags", "Num bags")}</th>
              <th className="w-[116px]">{headerBtn("balance_bags", "Balance bags")}</th>
              <th className="min-w-[100px]">{headerBtn("lot_status", "Status")}</th>
              <th className="min-w-[120px] text-right">{headerBtn("rent_pending", "Rent pending", "right")}</th>
              <th className="min-w-[128px] text-right">{headerBtn("charges_pending", "Charges pending", "right")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.transaction_type}-${row.event_id}`}
                className="border-b border-[var(--border-default)] last:border-b-0"
              >
                <td className={cellMuted}>{formatActivityDate(row.tx_date)}</td>
                <td className={cn(cellMono, "max-w-[160px] truncate")}>{row.lot_number}</td>
                <td className={cell}>{movementLabel(row)}</td>
                <td className={cn(cellMono, "max-w-[140px] truncate")}>{row.customer_code}</td>
                <td className={cn(cell, "max-w-[200px] truncate")}>{row.customer_name}</td>
                <td className={cn(cell, "max-w-[220px] truncate")}>{row.product_name}</td>
                <td className={cellMono}>{formatBagCount(row.num_bags)}</td>
                <td className={cellMono}>{formatBagCount(row.balance_bags)}</td>
                <td className={cellMuted}>{formatStatus(row.lot_status)}</td>
                <td className={cn(cellMono, "text-right")}>{formatIndianCurrency(row.rent_pending)}</td>
                <td className={cn(cellMono, "text-right")}>{formatIndianCurrency(row.charges_pending)}</td>
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
          <label className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="min-h-[48px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[16px] text-[var(--text-primary)]"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className={cn(
                "min-h-[48px] rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-[14px] font-medium text-[var(--text-primary)]",
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
                "min-h-[48px] rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-[14px] font-medium text-[var(--text-primary)]",
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
