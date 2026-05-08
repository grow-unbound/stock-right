"use client";

import type { MoneyMovementRow, MoneySortColumn } from "@stockright/shared/api";
import { cn } from "@/lib/utils";

interface MoneyActivityTableProps {
  rows: MoneyMovementRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortColumn: MoneySortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: MoneySortColumn) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  formatOccurredAt: (iso: string) => string;
  formatAmount: (row: MoneyMovementRow) => string;
  paymentMethodLabel: (raw: string | null) => string;
  referenceLabel: (row: MoneyMovementRow) => string;
}

function SortGlyph({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-tertiary)]" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </span>
  );
}

export function MoneyActivityTable({
  rows,
  totalCount,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  onSort,
  onPageChange,
  onPageSizeChange,
  formatOccurredAt,
  formatAmount,
  paymentMethodLabel,
  referenceLabel,
}: MoneyActivityTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  function headerBtn(col: MoneySortColumn, label: string) {
    const active = sortColumn === col;
    return (
      <button
        type="button"
        onClick={() => onSort(col)}
        className="flex min-h-[48px] w-full items-center px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {label}
        <SortGlyph active={active} dir={sortDirection} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--bg-subtle)]">
            <tr className="border-b border-[var(--border-default)]">
              <th className="w-[140px]">{headerBtn("occurred_at", "Date")}</th>
              <th className="w-[120px]">{headerBtn("transaction_type", "Type")}</th>
              <th>{headerBtn("counterparty_name", "Party / Customer")}</th>
              <th className="w-[140px]">{headerBtn("reference_number", "Reference")}</th>
              <th className="w-[120px]">{headerBtn("payment_method", "Method")}</th>
              <th className="w-[140px] text-right">{headerBtn("amount", "Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.transaction_type}-${row.event_id}`} className="border-b border-[var(--border-default)] last:border-b-0">
                <td className="px-3 py-3 font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-secondary)] tabular-nums">
                  {formatOccurredAt(row.occurred_at)}
                </td>
                <td className="px-3 py-3 text-[13px] capitalize text-[var(--text-secondary)]">{row.transaction_type}</td>
                <td className="max-w-[280px] px-3 py-3">
                  <span className="block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    {row.counterparty_name}
                  </span>
                  {row.transaction_type === "receipt" && row.customer_code ? (
                    <span className="mt-0.5 block truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]">
                      {row.customer_code}
                    </span>
                  ) : null}
                  {row.transaction_type === "receipt" && row.receipt_allocated === false ? (
                    <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                      Allocate amount
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]">
                  {referenceLabel(row)}
                </td>
                <td className="px-3 py-3 text-[13px] text-[var(--text-secondary)]">{paymentMethodLabel(row.payment_method)}</td>
                <td className="px-3 py-3 text-right font-[family-name:var(--font-display)] text-[15px] font-bold tabular-nums text-[var(--text-primary)]">
                  <span className={row.transaction_type === "receipt" ? "text-[var(--inward)]" : "text-[var(--outward)]"}>{formatAmount(row)}</span>
                  {row.payment_type_name ? (
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[10px] font-normal uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      {row.payment_type_name}
                    </span>
                  ) : null}
                </td>
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
