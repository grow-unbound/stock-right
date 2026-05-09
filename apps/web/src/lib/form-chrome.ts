const HIDE_CHROME_PATTERNS: RegExp[] = [
  /\/receipt\/new(\/|$)/,
  /^\/settings(\/|$)/,
];

/** Hide mobile bottom tab bar + FAB on full-screen / deep stack flows (<640px web). */
export function shouldHideMobileDashboardChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_CHROME_PATTERNS.some((re) => re.test(pathname));
}
