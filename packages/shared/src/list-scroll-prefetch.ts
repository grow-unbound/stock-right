/** Scroll depth (0–1) at which the next list page loads — 0.75 ∈ [0.72, 0.78], shared web + mobile. */
export const LIST_PREFETCH_SCROLL_RATIO = 0.75;

/** Sub-pixel / rounding slack so borderline-equal layoutMeasurement vs contentSize does not prefetch. */
const OVERFLOW_EPS_PX = 2;

export function listScrollDepthRatio(scrollTop: number, clientHeight: number, scrollHeight: number): number {
  if (scrollHeight <= 0) return 0;
  return (scrollTop + clientHeight) / scrollHeight;
}

export function shouldPrefetchListScroll(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  opts: { ratio?: number; hasMore: boolean; loading: boolean }
): boolean {
  if (!opts.hasMore || opts.loading) return false;
  if (scrollHeight <= clientHeight + OVERFLOW_EPS_PX) return false;
  const depth = listScrollDepthRatio(scrollTop, clientHeight, scrollHeight);
  return depth >= (opts.ratio ?? LIST_PREFETCH_SCROLL_RATIO);
}
