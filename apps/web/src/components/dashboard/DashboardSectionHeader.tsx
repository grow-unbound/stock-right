import type { ReactNode } from "react";

interface DashboardSectionHeaderProps {
  label: string;
  trailing?: ReactNode;
  className?: string;
}

export function DashboardSectionHeader({ label, trailing, className }: DashboardSectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between pt-1 ${className ?? ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {label}
      </span>
      {trailing ?? null}
    </div>
  );
}
