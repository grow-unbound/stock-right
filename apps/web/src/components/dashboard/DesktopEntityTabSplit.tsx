"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DesktopEntityTabSplitProps {
  /** Third pane visible */
  detailsOpen: boolean;
  list: ReactNode;
  details: ReactNode;
  className?: string;
}

export function DesktopEntityTabSplit({ detailsOpen, list, details, className }: DesktopEntityTabSplitProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 items-stretch gap-0", className)}>
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border-r border-[var(--border-default)]",
          detailsOpen ? "w-[400px] shrink-0" : "min-w-0 flex-1"
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 overflow-hidden transition-[flex,opacity] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          detailsOpen ? "flex min-w-0 flex-1 flex-col opacity-100" : "pointer-events-none w-0 min-w-0 flex-none opacity-0"
        )}
        aria-hidden={!detailsOpen}
      >
        {details}
      </div>
    </div>
  );
}
