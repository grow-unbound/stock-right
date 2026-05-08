"use client";

import { useEffect, useState } from "react";

export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return offline;
}
