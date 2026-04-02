import * as React from 'react';

const DEBOUNCE_MS = 150;

/**
 * Persists and restores scroll position for a scrollable element
 * via sessionStorage. Scroll offset is debounced to avoid thrashing storage.
 */
export function useScrollRestore(scrollRef: React.RefObject<HTMLElement | null>, key: string | undefined) {
  React.useEffect(() => {
    if (!key) return;
    const el = scrollRef.current;
    if (!el) return;

    // Restore
    try {
      const saved = sessionStorage.getItem(`scroll:${key}`);
      if (saved) {
        el.scrollTop = Number.parseInt(saved, 10);
      }
    } catch {
      // sessionStorage unavailable — skip
    }

    // Persist on scroll (debounced)
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
