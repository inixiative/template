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
 * Persists the top visible item index to sessionStorage, and exposes
 * the saved index for restoration via scrollToIndex.
 *
 * Unlike useScrollRestore (pixel-based), this is stable across
 * re-renders, nested scroll containers, and layout changes.
 */
export function useIndexRestore(key: string | undefined): {
  savedIndex: number | null;
  markRestored: () => void;
  persistIndex: (index: number) => void;
} {
  const [savedIndex] = React.useState<number | null>(() => {
    if (!key) return null;
    try {
      const saved = sessionStorage.getItem(`vindex:${key}`);
      return saved ? Number.parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  const restoredRef = React.useRef(false);
  const markRestored = React.useCallback(() => {
    restoredRef.current = true;
  }, []);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const persistIndex = React.useCallback(
    (index: number) => {
      if (!key || !restoredRef.current) return;
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

  return { savedIndex, markRestored, persistIndex };
}
