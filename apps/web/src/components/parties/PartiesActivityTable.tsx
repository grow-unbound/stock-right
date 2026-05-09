import type { PartiesTabListRow } from "@stockright/shared/parties-tab";
import { formatIndianCurrency } from "@stockright/shared/utils";
import {
  dataTableHeaderStatic,
  dataTableTdAmount,
  dataTableTdBodyMuted,
  dataTableTdMono,
  dataTableTdPrimary,
  dataTableTdCount,
} from "@/components/ui/data-table-classes";
import { TablePageSizeSelect } from "@/components/ui/table-page-size-select";
import { cn } from "@/lib/utils";

interface PartiesActivityTableProps {
  rows: PartiesTabListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

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
              <th className={cn(dataTableHeaderStatic, "text-center")}>Customer code</th>
              <th className={cn(dataTableHeaderStatic, "min-w-[140px]")}>Customer name</th>
              <th className={cn(dataTableHeaderStatic, "min-w-[160px]")}>Address</th>
              <th className={cn(dataTableHeaderStatic, "min-w-[140px] text-center")}>Active lots / bags</th>
              <th className={cn(dataTableHeaderStatic, "min-w-[140px] text-center")}>Aging lots / bags</th>
              <th className={cn(dataTableHeaderStatic, "min-w-[140px] text-center")}>Stale lots / bags</th>
              <th className={cn(dataTableHeaderStatic, "w-[120px] text-right")}>Rents pending</th>
              <th className={cn(dataTableHeaderStatic, "w-[120px] text-right")}>Charges pending</th>
              <th className={cn(dataTableHeaderStatic, "w-[128px] text-right")}>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.customer_id}
                className="border-b border-[var(--border-default)] last:border-b-0"
              >
                <td className={cn(dataTableTdMono, "max-w-[140px] truncate text-center")}>{row.customer_code}</td>
                <td className={cn(dataTableTdPrimary, "max-w-[200px] truncate")}>{row.customer_name}</td>
                <td className={cn(dataTableTdBodyMuted, "max-w-[220px]")}>
                  {row.address.trim() !== "" ? row.address : "—"}
                </td>
                <td className={dataTableTdCount}>{lotsBagsCell(row.fresh_lot_count, row.fresh_bag_count)}</td>
                <td className={dataTableTdCount}>{lotsBagsCell(row.aging_lot_count, row.aging_bag_count)}</td>
                <td className={dataTableTdCount}>{lotsBagsCell(row.stale_lot_count, row.stale_bag_count)}</td>
                <td className={dataTableTdAmount}>{formatIndianCurrency(row.outstanding_rents)}</td>
                <td className={dataTableTdAmount}>{formatIndianCurrency(row.outstanding_charges)}</td>
                <td className={cn(dataTableTdAmount, "font-semibold text-[var(--pending)]")}>
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
          <label
            className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-secondary)]"
            htmlFor="parties-table-page-size"
          >
            Rows per page
            <TablePageSizeSelect id="parties-table-page-size" value={pageSize} onChange={onPageSizeChange} />
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
