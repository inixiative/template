/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useDebouncedCallback } from '@template/ui/hooks/useDebounce';
import * as React from 'react';

const DEBOUNCE_MS = 150;

export type ScrollStateEntry = {
  scrollTop: number;
};

export type UseScrollStateOptions = {
  id: string;
  // Pass for viewport mode (overflow div); omit/null for window scroll.
  scrollRef?: React.RefObject<HTMLElement | null>;
  // Defer restore until data has loaded — set false while paginated list / filters resolve from URL.
  ready?: boolean;
  enabled?: boolean;
};

export type UseScrollStateResult = {
  hasSavedPosition: boolean;
};

// Per-container scroll offset persisted in history.state. Pairs with router
// scroll-restoration: router handles top-of-page nav, this handles offsets
// inside specific containers across back/forward and page reload.
export function useScrollState(options: UseScrollStateOptions): UseScrollStateResult {
  const { id, scrollRef, ready = true, enabled = true } = options;

  const stateKey = `scroll:${id}`;

  // Read saved position once on mount (only when enabled).
  const savedRef = React.useRef<number | null>(null);
  const initializedRef = React.useRef(false);
  if (!initializedRef.current && enabled) {
    initializedRef.current = true;
    try {
      const raw = window.history.state?.[stateKey];
      if (raw && typeof raw === 'object' && typeof raw.scrollTop === 'number') {
        savedRef.current = (raw as ScrollStateEntry).scrollTop;
      }
    } catch {
      // history.state read fails in SSR / sandboxed iframes — accept no restore
    }
  }

  const hasSavedPosition = savedRef.current !== null;

  // A ref with .current === null (e.g. no maxHeight on Table) falls through
  // to window scroll, same as no ref at all.
  const getScrollElement = React.useCallback((): HTMLElement | null => {
    if (scrollRef?.current) return scrollRef.current;
    return typeof document !== 'undefined' ? document.documentElement : null;
  }, [scrollRef]);

  // Restore scroll position once ready.
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || restoredRef.current || !ready) return;

    const saved = savedRef.current;
    if (saved === null || saved === 0) {
      restoredRef.current = true;
      return;
    }

    const el = getScrollElement();
    if (!el) return;

    // Mark restored inside the rAF so it only happens after the scroll
    // actually executes. If the DOM isn't tall enough yet, the scroll
    // will clamp to the max and we still mark it done (the data was ready
    // per the `ready` flag — any shortfall is the caller's responsibility).
    requestAnimationFrame(() => {
      if (scrollRef?.current) {
        el.scrollTop = saved;
      } else {
        window.scrollTo({ top: saved });
      }
      restoredRef.current = true;
    });
  }, [enabled, ready, getScrollElement, scrollRef]);

  // Persist scroll position on scroll (debounced). Reads the position when the timer fires, not on
  // the event, so the entry is where the scroll came to rest.
  const lastTopRef = React.useRef<number | null>(null);
  const persistScrollTop = useDebouncedCallback((el: HTMLElement, isElement: boolean) => {
    const scrollTop = isElement ? el.scrollTop : window.scrollY;
    if (scrollTop === lastTopRef.current) return;
    lastTopRef.current = scrollTop;
    try {
      const entry: ScrollStateEntry = { scrollTop };
      const state = { ...window.history.state, [stateKey]: entry };
      window.history.replaceState(state, '');
    } catch {
      // replaceState fails in SSR / sandboxed iframes / quota — accept partial state loss
    }
  }, DEBOUNCE_MS);

  React.useEffect(() => {
    if (!enabled) return;
    const el = getScrollElement();
    if (!el) return;

    const isElement = scrollRef?.current != null;
    const target = isElement ? el : window;
    const onScroll = () => persistScrollTop(el, isElement);

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      persistScrollTop.cancel();
      target.removeEventListener('scroll', onScroll);
    };
  }, [getScrollElement, scrollRef, enabled, persistScrollTop]);

  return { hasSavedPosition };
}
