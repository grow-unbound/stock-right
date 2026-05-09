import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTenantUserAdminAccess } from "@stockright/shared/hooks";
import { getSupabaseClient } from "@/lib/supabase";

interface UserAdminAccessContextValue {
  canManageTenantUsers: boolean;
  loaded: boolean;
}

const UserAdminAccessContext = createContext<UserAdminAccessContextValue | null>(null);

export function UserAdminAccessProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabaseClient(), []);
  const { canManageTenantUsers, loaded } = useTenantUserAdminAccess(client);

  const value = useMemo(
    (): UserAdminAccessContextValue => ({ canManageTenantUsers, loaded }),
    [canManageTenantUsers, loaded]
  );

  return (
    <UserAdminAccessContext.Provider value={value}>{children}</UserAdminAccessContext.Provider>
  );
}

export function useUserAdminAccessContext(): UserAdminAccessContextValue {
  const ctx = useContext(UserAdminAccessContext);
  if (!ctx) {
    throw new Error("useUserAdminAccessContext must be used within UserAdminAccessProvider");
  }
  return ctx;
}
