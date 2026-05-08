"use client";

import { SideNav } from "./SideNav";
import { BottomTabBar } from "./BottomTabBar";

interface AppShellProps {
  children: React.ReactNode;
  warehouseName?: string;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-[var(--bg-page)]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full min-h-0 sm:flex">
          <SideNav />
        </div>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 pt-4 sm:pb-6 sm:pt-6">
          {children}
        </main>
      </div>

      <div className="sm:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
