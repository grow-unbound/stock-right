"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseIsoLocal(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

interface DatePickerFieldProps {
  id?: string;
  value: string;
  onChange: (isoYmd: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerFieldProps) {
  const selected = useMemo(() => parseIsoLocal(value), [value]);
  const [open, setOpen] = useState(false);
  const labelText = selected
    ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-[var(--touch-target)] w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)]",
            "focus-visible:border-[var(--brand-ui)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
            !selected && "text-[var(--text-placeholder)]",
            disabled && "opacity-50",
            className
          )}
        >
          <span className="min-w-0 truncate font-[family-name:var(--font-body)]">{labelText}</span>
          <CalendarIcon className="size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toIsoLocal(d));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
