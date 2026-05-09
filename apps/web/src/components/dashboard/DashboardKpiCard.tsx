import { cn } from "@/lib/utils";

interface DashboardKpiCardProps {
  label: string;
  value: string;
  sub: string;
  accentClass: string;
  className?: string;
}

export function DashboardKpiCard({
  label,
  value,
  sub,
  accentClass,
  className,
}: DashboardKpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3",
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">{label}</p>
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[22px] font-semibold tabular-nums",
          accentClass
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-[var(--text-secondary)]">{sub}</p>
    </div>
  );
}
