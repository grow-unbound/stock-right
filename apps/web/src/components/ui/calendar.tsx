"use client";

import { DayPicker } from "react-day-picker";
import type { DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-2", className)}
      classNames={{
        root: "rdp-root font-[family-name:var(--font-body)]",
        months: "rdp-months flex flex-col gap-4 sm:flex-row",
        month: "rdp-month space-y-3",
        month_caption: "rdp-month_caption flex items-center justify-center px-1 pb-1 pt-1",
        caption_label:
          "rdp-caption_label text-[15px] font-semibold text-[var(--text-primary)] capitalize",
        nav: "rdp-nav flex items-center gap-1",
        button_previous:
          "rdp-button_previous flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        button_next:
          "rdp-button_next flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        month_grid: "rdp-month_grid w-full border-collapse",
        weekdays: "rdp-weekdays flex",
        weekday:
          "rdp-weekday w-9 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]",
        week: "rdp-week mt-1 flex w-full",
        day: "rdp-day p-0 text-center text-[14px]",
        day_button:
          "rdp-day_button flex size-9 items-center justify-center rounded-[var(--radius-md)] font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        selected:
          "[&_button]:bg-[var(--brand-ui)] [&_button]:text-[var(--text-on-brand)] [&_button]:hover:bg-[var(--brand-ui-hover)]",
        today: "[&_button]:border [&_button]:border-[var(--brand-border)]",
        disabled: "[&_button]:pointer-events-none [&_button]:text-[var(--text-placeholder)]",
        outside: "[&_button]:text-[var(--text-placeholder)]",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
