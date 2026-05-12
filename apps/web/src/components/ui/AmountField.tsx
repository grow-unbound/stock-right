"use client";

import {
  formatRupeeDigitsForInput,
  formatRupeeDigitsForInput2,
  formatRupeeInputLive,
  parseIndianRupeeInput,
} from "@stockright/shared/receipt";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface AmountFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  optionalSuffix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Right-align rupee amount (e.g. charge lines). */
  inputAlign?: "left" | "right";
  /** On blur, always show two fractional digits (e.g. …,60). */
  twoDecimalBlur?: boolean;
}

export function AmountField({
  id: idProp,
  label,
  value,
  onChange,
  optionalSuffix,
  placeholder = "0",
  disabled,
  className,
  inputAlign = "left",
  twoDecimalBlur,
}: AmountFieldProps) {
  const genId = useId();
  const id = idProp ?? genId;

  return (
    <div className={cn(className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]"
      >
        {label}
        {optionalSuffix ? (
          <span className="normal-case text-[var(--text-placeholder)]"> {optionalSuffix}</span>
        ) : null}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-secondary)]">
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(formatRupeeInputLive(e.target.value))}
          onBlur={() => {
            const n = parseIndianRupeeInput(value);
            if (n !== null) {
              onChange(twoDecimalBlur ? formatRupeeDigitsForInput2(n) : formatRupeeDigitsForInput(n));
            }
          }}
          className={cn(
            "min-h-[var(--touch-target)] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] py-2 pl-8 pr-3 font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]",
            inputAlign === "right" && "text-right",
            disabled && "cursor-not-allowed opacity-[0.72] text-[var(--text-secondary)]"
          )}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
