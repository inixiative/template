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
        // Use rAF to ensure the browser has laid out the content
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
