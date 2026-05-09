"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Package, Users, Banknote } from "lucide-react";
import { useMoneyAccess } from "@/contexts/MoneyAccessContext";
import { shouldHideMobileDashboardChrome } from "@/lib/form-chrome";
import { cn } from "@/lib/utils";

interface DashboardTabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresMoney?: boolean;
}

const tabs: DashboardTabItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/money", label: "Money", icon: Banknote, requiresMoney: true },
];

export function BottomTabBar() {
  const pathname = usePathname() ?? "";
  const { canManageMoney, loaded } = useMoneyAccess();
  const visibleTabs = tabs.filter((t) => !t.requiresMoney || !loaded || canManageMoney);

  if (shouldHideMobileDashboardChrome(pathname)) {
    return null;
  }

  return (
    <nav
      className="relative flex items-start justify-around gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-2 pt-1.5"
      style={{
        height: "var(--tabbar-height)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {visibleTabs.map(({ href, label, icon: Icon }) => {
        const base = pathname.replace(/\/$/, "") || "/";
        const hrefNorm = href.replace(/\/$/, "") || "/";
        const active =
          hrefNorm === "/"
            ? base === "/"
            : base === hrefNorm || base.startsWith(`${hrefNorm}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-[48px] flex-1 flex-col items-center gap-1 rounded-[10px] py-1.5",
              active ? "bg-[var(--brand-subtle)]" : ""
            )}
          >
            <Icon
              size={22}
              className={active ? "text-[var(--brand-text)]" : "text-[var(--text-tertiary)]"}
              strokeWidth={2}
            />
            <span
              className={cn(
                "max-w-[72px] text-center text-[11px]",
                active ? "font-semibold text-[var(--brand-text)]" : "font-medium text-[var(--text-tertiary)]"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
