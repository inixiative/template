import * as React from 'react';

const DEBOUNCE_MS = 150;

/**
 * Persists and restores scroll position for a scrollable element
 * via sessionStorage. Scroll offset is debounced to avoid thrashing storage.
 *
 * Pass `ready: false` to defer restoration until data has loaded —
 * otherwise scroll restores to a position that doesn't exist yet.
 */
export function useScrollRestore(
  scrollRef: React.RefObject<HTMLElement | null>,
  key: string | undefined,
  ready = true,
) {
  const restoredRef = React.useRef(false);

  // Restore scroll position once ready
  React.useEffect(() => {
    if (!key || !ready || restoredRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(`scroll:${key}`);
      if (saved) {
        requestAnimationFrame(() => {
          el.scrollTop = Number.parseInt(saved, 10);
        });
      }
    } catch {
      // sessionStorage unavailable — skip
    }
  }, [key, ready, scrollRef]);

  // Persist on scroll (debounced)
  React.useEffect(() => {
    if (!key) return;
    const el = scrollRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(`scroll:${key}`, String(el.scrollTop));
        } catch {
          // skip
        }
      }, DEBOUNCE_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
    };
  }, [key, scrollRef]);
}

const INDEX_DEBOUNCE_MS = 200;

/**
 * Persists the top visible item index to sessionStorage, and restores
 * via a provided scrollToIndex callback once data is ready.
 *
 * Handles its own lifecycle — consumers just wire it up and call
 * `onVisibleIndexChange` when the top visible item changes.
 */
export function useIndexRestore(
  key: string | undefined,
  itemCount: number,
  scrollToIndex: ((index: number) => void) | null,
  /** Scroll container element — scrolled into viewport before internal restore. */
  containerRef?: React.RefObject<HTMLElement | null>,
): {
  onVisibleIndexChange: (index: number) => void;
} {
  // Read saved index once on mount
  const savedIndexRef = React.useRef<number | null>(null);
  const initializedRef = React.useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    if (key) {
      try {
        const saved = sessionStorage.getItem(`vindex:${key}`);
        savedIndexRef.current = saved ? Number.parseInt(saved, 10) : null;
      } catch {
        // skip
      }
    }
  }

  // Restore once data and scrollToIndex are available
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current || itemCount === 0 || !scrollToIndex) return;
    const saved = savedIndexRef.current;
    if (saved === null || saved >= itemCount) {
      restoredRef.current = true;
      return;
    }
    restoredRef.current = true;
    // Scroll the container into the viewport first, then restore internal position
    if (containerRef?.current) {
      containerRef.current.scrollIntoView({ block: 'nearest' });
    }
    scrollToIndex(saved);
  }, [itemCount, scrollToIndex, containerRef]);

  // Persist with change guard + debounce
  const lastPersistedRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onVisibleIndexChange = React.useCallback(
    (index: number) => {
      if (!key || !restoredRef.current || index === lastPersistedRef.current) return;
      lastPersistedRef.current = index;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem(`vindex:${key}`, String(index));
        } catch {
          // skip
        }
      }, INDEX_DEBOUNCE_MS);
    },
    [key],
  );

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { onVisibleIndexChange };
}
