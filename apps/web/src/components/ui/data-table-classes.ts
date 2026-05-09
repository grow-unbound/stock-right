import { cn } from "@/lib/utils";

export const dataTableHeaderBtn =
  "flex min-h-[48px] w-full items-center px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

export const dataTableHeaderStatic =
  "px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]";

export const dataTableTdBody =
  "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-primary)]";

export const dataTableTdBodyMuted =
  "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-normal leading-snug text-[var(--text-secondary)]";

export const dataTableTdPrimary =
  "px-3 py-2.5 font-[family-name:var(--font-body)] text-[15px] font-semibold leading-snug text-[var(--text-primary)]";

export const dataTableTdMono =
  "px-3 py-2.5 font-[family-name:var(--font-mono)] text-[15px] font-normal leading-snug text-[var(--text-secondary)] tabular-nums";

export const dataTableTdMonoStrong =
  "px-3 py-2.5 font-[family-name:var(--font-mono)] text-[15px] font-normal leading-snug text-[var(--text-primary)] tabular-nums";

export const dataTableTdCount =
  "px-3 py-2.5 text-center font-[family-name:var(--font-mono)] text-[15px] font-normal tabular-nums text-[var(--text-primary)]";

export const dataTableTdAmount =
  "px-3 py-2.5 text-right font-[family-name:var(--font-mono)] text-[15px] font-normal tabular-nums text-[var(--text-primary)]";

export function dataTableSortGlyph(active: boolean, dir: "asc" | "desc"): string {
  return active ? (dir === "asc" ? "↑" : "↓") : "";
}

export function dataTableHeaderButtonClasses(align: "left" | "right" | "center"): string {
  return cn(
    dataTableHeaderBtn,
    align === "right" && "justify-end text-right",
    align === "center" && "justify-center text-center"
  );
}
