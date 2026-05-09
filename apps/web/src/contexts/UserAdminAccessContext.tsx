"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTenantUserAdminAccess } from "@stockright/shared/hooks";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface UserAdminAccessContextValue {
  canManageTenantUsers: boolean;
  loaded: boolean;
  refresh: () => void;
}

const UserAdminAccessContext = createContext<UserAdminAccessContextValue | null>(null);

export function UserAdminAccessProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const { canManageTenantUsers, loaded, refresh } = useTenantUserAdminAccess(client);

  const value = useMemo(
    (): UserAdminAccessContextValue => ({
      canManageTenantUsers,
      loaded,
      refresh,
    }),
    [canManageTenantUsers, loaded, refresh]
  );

  return (
    <UserAdminAccessContext.Provider value={value}>{children}</UserAdminAccessContext.Provider>
  );
}

export function useUserAdminAccess(): UserAdminAccessContextValue {
  const ctx = useContext(UserAdminAccessContext);
  if (!ctx) {
    throw new Error("useUserAdminAccess must be used within UserAdminAccessProvider");
  }
  return ctx;
}
