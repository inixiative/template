import * as React from 'react';

const DEBOUNCE_MS = 150;

export type ScrollStateEntry = {
  /** Scroll offset in pixels at time of navigation. */
  scrollTop: number;
};

export type UseScrollStateOptions = {
  /**
   * Unique identifier for this scroll container. Multiple containers
   * on the same page each get their own key in history.state.
   */
  id: string;
  /**
   * The scroll container element ref. For viewport mode (overflow div),
   * pass the div ref. For window mode, pass undefined or null —
   * the hook will use document.documentElement automatically.
   */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /**
   * Whether enough data has loaded to make scroll restoration meaningful.
   * When false, restoration is deferred. Defaults to true.
   */
  ready?: boolean;
  /**
   * Whether scroll state tracking is enabled. When false, the hook
   * does nothing (no restore, no persist). Defaults to true.
   */
  enabled?: boolean;
};

export type UseScrollStateResult = {
  /** Whether saved state was found but couldn't be restored (e.g. not ready). */
  hasSavedPosition: boolean;
};

/**
 * Persists and restores scroll position via history.state for a single
 * scroll container. On back/forward navigation, restores the pixel
 * offset. On fresh navigation (link click), history.state has no entry
 * so the container starts at the top.
 *
 * Works for both viewport containers (overflow div) and window scroll
 * (pass no scrollRef to use the window).
 *
 * Multiple instances on the same page each track their own key in
 * history.state, independent of each other.
 *
 * Usage:
 * ```tsx
 * // Viewport container
 * const scrollRef = useRef<HTMLDivElement>(null);
 * useScrollState({ id: 'users-table', scrollRef });
 *
 * // Window scroll
 * useScrollState({ id: 'main-feed' });
 * ```
 */
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
      // SSR or sandboxed iframe
    }
  }

  const hasSavedPosition = savedRef.current !== null;

  // Resolve the scroll element: explicit ref (if attached) or window.
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

  // Clear stale entry if we couldn't restore (not ready after mount).
  React.useEffect(() => {
    if (restoredRef.current || savedRef.current === null) return;
    // If ready never becomes true and component unmounts, the entry persists.
    // That's acceptable — next navigation will try again.
  }, []);

  // Persist scroll position on scroll (debounced).
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTopRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const el = getScrollElement();
    if (!el) return;

    const isElement = scrollRef?.current != null;
    const target = isElement ? el : window;

    const onScroll = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const scrollTop = isElement ? el.scrollTop : window.scrollY;
        if (scrollTop === lastTopRef.current) return;
        lastTopRef.current = scrollTop;
        try {
          const entry: ScrollStateEntry = { scrollTop };
          const state = { ...window.history.state, [stateKey]: entry };
          window.history.replaceState(state, '');
        } catch {
          // skip
        }
      }, DEBOUNCE_MS);
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timerRef.current);
      target.removeEventListener('scroll', onScroll);
    };
  }, [stateKey, getScrollElement, scrollRef]);

  // Cleanup timer on unmount.
  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { hasSavedPosition };
}
