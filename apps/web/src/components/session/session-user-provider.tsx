"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserSessionContext } from "@stockright/shared/types";

export interface SessionUserValue {
  context: UserSessionContext | null;
  canSwitchWarehouse: boolean;
}

const SessionUserContext = createContext<SessionUserValue | null>(null);

export function SessionUserProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SessionUserValue;
}) {
  return <SessionUserContext.Provider value={value}>{children}</SessionUserContext.Provider>;
}

export function useSessionUser(): SessionUserValue {
  const v = useContext(SessionUserContext);
  if (!v) {
    throw new Error("useSessionUser must be used within SessionUserProvider");
  }
  return v;
}
