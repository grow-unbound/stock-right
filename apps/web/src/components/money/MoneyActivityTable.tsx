"use client";

import type { MoneyMovementRow, MoneySortColumn } from "@stockright/shared/api";
import { displayMoneyPartyPrimary } from "@stockright/shared/money";
import { formatIndianCurrency } from "@stockright/shared/utils";
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
  paymentMethodLabel: (raw: string | null) => string;
  referenceLabel: (row: MoneyMovementRow) => string;
}

const cell = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-primary)]";
const cellMuted = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-secondary)]";
const cellMono = "px-3 py-2.5 font-[family-name:var(--font-mono)] text-[15px] font-normal leading-snug text-[var(--text-secondary)] tabular-nums";

function SortGlyph({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </span>
  );
}

function additionalDetails(row: MoneyMovementRow): { lines: string[]; showAllocation: boolean } {
  if (row.transaction_type === "receipt") {
    const code = row.customer_code?.trim();
    return {
      lines: code ? [code] : [],
      showAllocation: row.receipt_allocated === false,
    };
  }
  const n = row.notes?.trim();
  return { lines: n ? [n] : [], showAllocation: false };
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
        className="flex min-h-[48px] w-full items-center px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {label}
        <SortGlyph active={active} dir={sortDirection} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--bg-subtle)]">
            <tr className="border-b border-[var(--border-default)]">
              <th className="min-w-[120px]">{headerBtn("reference_number", "Reference number")}</th>
              <th className="w-[100px]">{headerBtn("occurred_at", "Date")}</th>
              <th className="w-[100px]">{headerBtn("transaction_type", "Type")}</th>
              <th className="min-w-[160px]">{headerBtn("counterparty_name", "Party / expense type")}</th>
              <th className="min-w-[140px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Additional details
              </th>
              <th className="w-[120px]">{headerBtn("payment_method", "Method")}</th>
              <th className="w-[120px] text-right">{headerBtn("amount", "Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extra = additionalDetails(row);
              return (
                <tr key={`${row.transaction_type}-${row.event_id}`} className="border-b border-[var(--border-default)] last:border-b-0">
                  <td className={cn(cellMono, "max-w-[200px] truncate")}>{referenceLabel(row)}</td>
                  <td className={cellMono}>{formatOccurredAt(row.occurred_at)}</td>
                  <td className={cn(cellMuted, "capitalize")}>{row.transaction_type}</td>
                  <td className={cn(cell, "max-w-[220px] truncate")}>{displayMoneyPartyPrimary(row)}</td>
                  <td className={cn(cell, "max-w-[220px] align-top")}>
                    {extra.lines.map((line, i) => (
                      <span key={`${line}-${i}`} className="block truncate">
                        {line}
                      </span>
                    ))}
                    {extra.showAllocation ? (
                      <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                        Needs allocation
                      </span>
                    ) : null}
                    {!extra.lines.length && !extra.showAllocation ? <span className="text-[var(--text-tertiary)]">—</span> : null}
                  </td>
                  <td className={cellMuted}>{paymentMethodLabel(row.payment_method)}</td>
                  <td className="px-3 py-2.5 text-right align-top">
                    <span
                      className={cn(
                        "font-[family-name:var(--font-display)] text-[28px] font-bold tabular-nums leading-none",
                        row.transaction_type === "receipt" ? "text-[var(--inward)]" : "text-[var(--outward)]"
                      )}
                    >
                      {formatIndianCurrency(row.amount)}
                    </span>
                  </td>
                </tr>
              );
            })}
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
