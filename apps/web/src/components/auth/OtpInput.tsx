"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(-1);
    const newVal = value.split("");
    newVal[index] = digit;
    const next = newVal.join("");
    onChange(next);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      const newVal = value.split("");
      newVal[index - 1] = "";
      onChange(newVal.join(""));
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      inputsRef.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 justify-center" onPaste={handlePaste}>
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={disabled}
            className={cn(
              "w-12 h-14 text-center text-[22px] font-semibold rounded-[var(--radius-md)] border-[1.5px]",
              "bg-[var(--bg-subtle)] text-[var(--text-primary)]",
              "focus:outline-none focus:border-[var(--brand-ui)] focus:ring-[3px] focus:ring-[var(--focus-ring)]",
              "transition-colors duration-[var(--duration-fast)]",
              "disabled:opacity-40",
              error
                ? "border-[var(--outward)]"
                : value[i]
                ? "border-[var(--brand-ui)] bg-[var(--brand-subtle)]"
                : "border-[var(--border-default)]"
            )}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-[13px] text-[var(--outward)]">{error}</p>
      )}
    </div>
  );
}
