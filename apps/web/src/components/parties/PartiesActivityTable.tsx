import type { PartiesTabListRow } from "@stockright/shared/parties-tab";
import { formatIndianCurrency } from "@stockright/shared/utils";
import { cn } from "@/lib/utils";

interface PartiesActivityTableProps {
  rows: PartiesTabListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const cell = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-primary)]";
const cellMuted = "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-secondary)]";
const cellMono = "px-3 py-2.5 font-[family-name:var(--font-mono)] text-[15px] font-normal leading-snug text-[var(--text-secondary)] tabular-nums";

function formatIn(n: number): string {
  return n.toLocaleString("en-IN");
}

function lotsBagsCell(lotCount: number, bagCount: number): string {
  if (lotCount === 0 && bagCount === 0) return "—";
  return `${formatIn(lotCount)} lots · ${formatIn(bagCount)} bags`;
}

export function PartiesActivityTable({
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PartiesActivityTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <table className="w-full min-w-[1160px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-[var(--bg-subtle)]">
            <tr className="border-b border-[var(--border-default)]">
              <th className="px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Customer Code
              </th>
              <th className="min-w-[140px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Customer Name
              </th>
              <th className="min-w-[160px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Address
              </th>
              <th className="min-w-[140px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Active Lots (#Bags)
              </th>
              <th className="min-w-[140px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Aging Lots (#Bags)
              </th>
              <th className="min-w-[140px] px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Stale Lots (#Bags)
              </th>
              <th className="w-[120px] px-3 py-2 text-right font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Rents Pending
              </th>
              <th className="w-[120px] px-3 py-2 text-right font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Charges Pending
              </th>
              <th className="w-[128px] px-3 py-2 text-right font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Outstanding
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.customer_id}
                className="border-b border-[var(--border-default)] last:border-b-0"
              >
                <td className={cn(cellMono, "max-w-[140px] truncate")}>{row.customer_code}</td>
                <td className={cn(cell, "max-w-[200px] truncate")}>{row.customer_name}</td>
                <td className={cn(cellMuted, "max-w-[220px]")}>
                  {row.address.trim() !== "" ? row.address : "—"}
                </td>
                <td className={cellMuted}>{lotsBagsCell(row.fresh_lot_count, row.fresh_bag_count)}</td>
                <td className={cellMuted}>{lotsBagsCell(row.aging_lot_count, row.aging_bag_count)}</td>
                <td className={cellMuted}>{lotsBagsCell(row.stale_lot_count, row.stale_bag_count)}</td>
                <td className={cn(cellMono, "text-right tabular-nums")}>
                  {formatIndianCurrency(row.outstanding_rents)}
                </td>
                <td className={cn(cellMono, "text-right tabular-nums")}>
                  {formatIndianCurrency(row.outstanding_charges)}
                </td>
                <td className={cn(cellMono, "text-right tabular-nums text-[var(--pending)]")}>
                  {formatIndianCurrency(row.outstanding_total)}
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
