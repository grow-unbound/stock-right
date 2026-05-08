"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  pill?: boolean;
  full?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--brand-ui)] text-[var(--text-on-brand)] hover:bg-[var(--brand-ui-hover)] active:bg-[var(--brand-ui-press)]",
  secondary:
    "bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-inset)]",
  ghost:
    "bg-transparent border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
  danger:
    "bg-[var(--outward-bg)] text-[var(--outward)] hover:bg-[var(--outward-border)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-[var(--touch-target)] px-3 text-[13px] leading-snug",
  default: "min-h-[var(--touch-target)] px-4 text-[14px] leading-snug",
  lg: "min-h-[var(--touch-target)] px-5 text-[15px] leading-snug",
};

export function Button({
  variant = "primary",
  size = "default",
  pill = false,
  full = false,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        "duration-[var(--duration-fast)]",
        variantClasses[variant],
        sizeClasses[size],
        pill ? "rounded-[var(--radius-pill)]" : "rounded-[var(--radius-md)]",
        full ? "w-full" : "",
        className
      )}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
