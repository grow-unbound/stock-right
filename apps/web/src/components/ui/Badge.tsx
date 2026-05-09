import { cn } from "@/lib/utils";

type BadgeVariant =
  | "inward"
  | "outward"
  | "pending"
  | "brand"
  | "neutral"
  | "online"
  | "offline";

const variantClasses: Record<BadgeVariant, string> = {
  inward:  "bg-[var(--inward-bg)] text-[var(--inward)] border-[var(--inward-border)]",
  outward: "bg-[var(--outward-bg)] text-[var(--outward)] border-[var(--outward-border)]",
  pending: "bg-[var(--pending-bg)] text-[var(--pending)] border-[var(--pending-border)]",
  brand:   "bg-[var(--brand-subtle)] text-[var(--brand-text)] border-[var(--brand-border)]",
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-tertiary)] border-[var(--border-default)]",
  online:  "bg-[var(--inward-bg)] text-[var(--inward)] border-[var(--inward-border)]",
  offline: "bg-[var(--pending-bg)] text-[var(--pending)] border-[var(--pending-border)]",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-1",
        "font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.04em] leading-none",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
