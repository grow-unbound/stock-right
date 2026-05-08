"use client";

import { Zap } from "lucide-react";

interface OfflineBannerProps {
  queueCount: number;
}

export function OfflineBanner({ queueCount }: OfflineBannerProps) {
  const entryWord = queueCount === 1 ? "entry" : "entries";
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-[var(--pending-border)] bg-[var(--pending-bg)] px-4 py-2"
      role="status"
    >
      <Zap className="size-3.5 shrink-0 text-[var(--pending)]" fill="currentColor" aria-hidden />
      <p className="text-[12px] font-medium text-[var(--pending)]">
        Offline · {queueCount} {entryWord} queued — will upload when connected
      </p>
    </div>
  );
}
