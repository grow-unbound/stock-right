import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Input({ label, error, helper, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[13px] font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          // Height 36px visual, font 16px LOCKED (iOS auto-zoom prevention)
          "h-9 w-full rounded-[var(--radius-md)] border-[1.5px] px-3",
          "text-[16px] text-[var(--text-primary)] bg-[var(--bg-surface)]",
          "placeholder:text-[var(--text-placeholder)] placeholder:text-[15px]",
          "transition-colors duration-[var(--duration-fast)]",
          "focus:outline-none focus:border-[var(--brand-ui)] focus:ring-[3px] focus:ring-[var(--focus-ring)]",
          error
            ? "border-[var(--outward)]"
            : "border-[var(--border-default)]",
          // Tap zone: min-height 48px ensures touch target
          "min-h-[48px]",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-[12px] text-[var(--outward)]">{error}</p>
      )}
      {helper && !error && (
        <p className="text-[12px] text-[var(--text-tertiary)]">{helper}</p>
      )}
    </div>
  );
}
