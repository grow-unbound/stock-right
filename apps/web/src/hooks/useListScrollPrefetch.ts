"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  LIST_PREFETCH_SCROLL_RATIO,
  shouldPrefetchListScroll,
} from "@stockright/shared/list-scroll-prefetch";

export function useListScrollPrefetch(args: {
  scrollRef: RefObject<HTMLElement | null>;
  hasMore: boolean;
  loadingMore: boolean;
  onPrefetch: () => void;
  ratio?: number;
  enabled?: boolean;
  watchKey?: number | string;
}): void {
  const {
    scrollRef,
    hasMore,
    loadingMore,
    onPrefetch,
    ratio = LIST_PREFETCH_SCROLL_RATIO,
    enabled = true,
    watchKey = 0,
  } = args;
  const onPrefetchRef = useRef(onPrefetch);
  onPrefetchRef.current = onPrefetch;

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const check = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const t = el.scrollTop;
        const ch = el.clientHeight;
        const sh = el.scrollHeight;
        if (
          shouldPrefetchListScroll(t, ch, sh, {
            hasMore,
            loading: loadingMore,
            ratio,
          })
        ) {
          onPrefetchRef.current();
        }
      });
    };

    el.addEventListener("scroll", check, { passive: true });
    check();
    return () => el.removeEventListener("scroll", check);
  }, [enabled, hasMore, loadingMore, ratio, scrollRef, watchKey]);
}
