import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RegisterListRowProps {
  icon: ReactNode;
  /** Full Tailwind for the 40×40 icon shell (semantic bg, no border). */
  iconShellClassName: string;
  meta: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing: ReactNode;
  trailingSub?: ReactNode;
  /** Use `button` for interactive rows (keyboard/focus). */
  as?: "div" | "button";
  onClick?: () => void;
  className?: string;
}

export function RegisterListRow({
  icon,
  iconShellClassName,
  meta,
  title,
  detail,
  trailing,
  trailingSub,
  as = "div",
  onClick,
  className,
}: RegisterListRowProps) {
  const inner = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
          iconShellClassName
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-[var(--text-tertiary)]">{meta}</span>
        <span className="block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
          {title}
        </span>
        {detail ? <div className="mt-0.5 space-y-1 text-[12px] text-[var(--text-secondary)]">{detail}</div> : null}
      </span>
      <span className="shrink-0 text-right">
        {trailing}
        {trailingSub ? (
          <span className="mt-1 block text-[12px] font-[family-name:var(--font-body)] capitalize text-[var(--text-secondary)]">
            {trailingSub}
          </span>
        ) : null}
      </span>
    </>
  );

  const shellClass = cn(
    "flex w-full min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-left transition-opacity",
    as === "button" &&
      "hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] cursor-pointer",
    as === "div" && "cursor-default",
    className
  );

  if (as === "button") {
    return (
      <button type="button" className={shellClass} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
