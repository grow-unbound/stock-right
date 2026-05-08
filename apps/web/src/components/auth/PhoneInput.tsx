"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function PhoneInput({ value, onChange, error, className, ...props }: PhoneInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(digits ? `+91${digits}` : "");
  }

  const displayValue = value.startsWith("+91") ? value.slice(3) : value;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[var(--text-secondary)]">
        Phone Number
      </label>
      <div
        className={cn(
          "flex items-center rounded-[var(--radius-md)] border-[1.5px] bg-[var(--bg-surface)] overflow-hidden",
          "focus-within:border-[var(--brand-ui)] focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]",
          "transition-colors duration-[var(--duration-fast)] min-h-[48px]",
          error ? "border-[var(--outward)]" : "border-[var(--border-default)]"
        )}
      >
        <div className="flex items-center px-3 border-r border-[var(--border-default)] h-full">
          <span className="text-[16px] font-medium text-[var(--text-secondary)] select-none">
            +91
          </span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder="98765 43210"
          className={cn(
            "flex-1 h-9 px-3 bg-transparent outline-none",
            "text-[16px] text-[var(--text-primary)]", // 16px LOCKED — iOS zoom prevention
            "placeholder:text-[var(--text-placeholder)] placeholder:text-[15px]",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-[12px] text-[var(--outward)]">{error}</p>}
    </div>
  );
}
