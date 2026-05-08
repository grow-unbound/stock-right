"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMoneyAccess as useMoneyAccessShared } from "@stockright/shared/hooks";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface MoneyAccessContextValue {
  canManageMoney: boolean;
  loaded: boolean;
  refresh: () => void;
}

const MoneyAccessContext = createContext<MoneyAccessContextValue | null>(null);

export function MoneyAccessProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const { canManageMoney, loaded, refresh } = useMoneyAccessShared(client);

  const value = useMemo(
    (): MoneyAccessContextValue => ({
      canManageMoney,
      loaded,
      refresh,
    }),
    [canManageMoney, loaded, refresh]
  );

  return <MoneyAccessContext.Provider value={value}>{children}</MoneyAccessContext.Provider>;
}

export function useMoneyAccess(): MoneyAccessContextValue {
  const ctx = useContext(MoneyAccessContext);
  if (!ctx) {
    throw new Error("useMoneyAccess must be used within MoneyAccessProvider");
  }
  return ctx;
}
