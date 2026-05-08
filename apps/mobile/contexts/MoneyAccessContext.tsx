import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMoneyAccess } from "@stockright/shared/hooks";
import { getSupabaseClient } from "@/lib/supabase";

interface MoneyAccessContextValue {
  canManageMoney: boolean;
  loaded: boolean;
}

const MoneyAccessContext = createContext<MoneyAccessContextValue | null>(null);

export function MoneyAccessProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabaseClient(), []);
  const { canManageMoney, loaded } = useMoneyAccess(client);

  const value = useMemo(
    (): MoneyAccessContextValue => ({ canManageMoney, loaded }),
    [canManageMoney, loaded]
  );

  return <MoneyAccessContext.Provider value={value}>{children}</MoneyAccessContext.Provider>;
}

export function useMoneyAccessContext(): MoneyAccessContextValue {
  const ctx = useContext(MoneyAccessContext);
  if (!ctx) {
    throw new Error("useMoneyAccessContext must be used within MoneyAccessProvider");
  }
  return ctx;
}
