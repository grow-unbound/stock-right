"use client";

import type { ReactNode } from "react";

export default function UsersNewTemplate({ children }: { children: ReactNode }) {
  return <div className="deep-route-enter">{children}</div>;
}
