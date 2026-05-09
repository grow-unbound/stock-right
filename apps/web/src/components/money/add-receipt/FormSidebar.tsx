"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { FORM_DRAWER_PANEL_WIDTH_CLASS } from "./form-drawer-classes";

interface FormSidebarProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function FormSidebar({ open, title, onClose, children }: FormSidebarProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(28,26,22,0.45)]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={[
          "absolute inset-y-0 right-0 flex max-h-[100dvh] min-h-0 flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-3)]",
          FORM_DRAWER_PANEL_WIDTH_CLASS,
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-sidebar-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
          <h2
            id="form-sidebar-title"
            className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]"
          >
            {title}
          </h2>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </div>
  );
}
