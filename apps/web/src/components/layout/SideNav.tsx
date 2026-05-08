"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Package, Users, Banknote, UserCircle, LogOut } from "lucide-react";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";
import { Badge } from "@/components/ui/Badge";
import { useIsOffline } from "@/hooks/useIsOffline";
import { useMoneyAccess } from "@/contexts/MoneyAccessContext";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/session";
import { useSessionUser } from "@/components/session/session-user-provider";

interface SideNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresMoney?: boolean;
}

const navItems: SideNavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/money", label: "Money", icon: Banknote, requiresMoney: true },
  { href: "/settings", label: "Preferences", icon: UserCircle },
];

export function SideNav() {
  const pathname = usePathname() ?? "";
  const offline = useIsOffline();
  const { context } = useSessionUser();
  const { canManageMoney, loaded } = useMoneyAccess();

  const displayName = context?.fullName?.trim() || context?.phone || "Account";
  const subtitleLine =
    context?.warehouseName != null
      ? `${context.roleLabel} · ${context.warehouseName}`
      : `${context?.roleLabel ?? "—"}`;

  const visibleItems = navItems.filter((item) => !item.requiresMoney || !loaded || canManageMoney);

  return (
    <nav
      className="flex h-full min-h-0 flex-col overflow-hidden border-r border-[var(--border-default)] bg-[var(--bg-subtle)]"
      style={{ width: "var(--sidenav-width)" }}
    >
      <div className="shrink-0 border-b border-[var(--border-default)] px-4 py-5">
        <Image src="/wordmark.svg" alt="StockRight" width={120} height={24} priority />
      </div>

      {offline && (
        <div className="shrink-0 px-3 py-2">
          <Badge variant="offline" className="w-full justify-center py-1.5">
            ⚡ {DEMO_PROFILE_USER.offlineQueuedCount} queued
          </Badge>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-2 py-4">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const base = pathname.replace(/\/$/, "") || "/";
            const hrefNorm = href.replace(/\/$/, "") || "/";
            const isActive =
              hrefNorm === "/"
                ? base === "/"
                : base === hrefNorm || base.startsWith(`${hrefNorm}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[var(--touch-target)] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-3 text-[14px] font-medium leading-snug transition-colors duration-[var(--duration-fast)]",
                  isActive
                    ? "bg-[var(--brand-subtle)] font-semibold text-[var(--brand-text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 flex-col px-2 py-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-[var(--touch-target)] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[14px] font-medium text-[var(--outward)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            aria-label="Log out"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Log out
          </button>
        </form>

        <div className="my-2 border-t border-[var(--border-default)]" aria-hidden />

        <div className="flex min-h-[var(--touch-target)] items-center gap-2 rounded-[10px] px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--brand-subtle)] font-[family-name:var(--font-display)] text-[14px] font-semibold text-[var(--brand-text)]">
            {context?.initials ?? "?"}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[14px] font-semibold leading-snug text-[var(--text-primary)]">{displayName}</p>
            <p className="truncate text-[12px] leading-snug text-[var(--text-secondary)]">{subtitleLine}</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
