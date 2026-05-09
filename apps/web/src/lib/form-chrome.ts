/** Hide mobile bottom tab bar + FAB chrome on full-screen form flows (<640px web + specs parity). */
export function shouldHideMobileDashboardChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.includes("/receipt/new")) return true;
  return false;
}
