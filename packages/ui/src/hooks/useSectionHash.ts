import * as React from 'react';

const SCROLL_DEBOUNCE_MS = 200;

export type UseSectionHashOptions = {
  /**
   * Map of section IDs to their element refs. The hook observes these
   * elements and updates the URL hash to the most visible section.
   * Also scrolls to the matching section on mount if the URL has a hash.
   */
  sections: Record<string, React.RefObject<HTMLElement | null>>;
  /**
   * IntersectionObserver threshold. The section with the highest
   * intersection ratio becomes the active hash. Defaults to 0.5.
   */
  threshold?: number;
};

export type UseSectionHashResult = {
  /** The currently active section ID (from the URL hash or scroll). */
  activeSection: string | null;
  /** Scroll to a section and update the hash. */
  scrollToSection: (sectionId: string) => void;
};

/**
 * Syncs the URL hash with the most visible section on the page.
 *
 * On mount: if the URL has a hash matching a section ID, scrolls to it.
 * On scroll: updates the URL hash to the most visible section (debounced).
 * On call: scrollToSection programmatically scrolls and updates the hash.
 *
 * Usage:
 * ```tsx
 * const usersRef = useRef<HTMLDivElement>(null);
 * const logsRef = useRef<HTMLDivElement>(null);
 *
 * const { activeSection, scrollToSection } = useSectionHash({
 *   sections: { users: usersRef, logs: logsRef },
 * });
 *
 * return (
 *   <>
 *     <nav>
 *       <a onClick={() => scrollToSection('users')}>Users</a>
 *       <a onClick={() => scrollToSection('logs')}>Logs</a>
 *     </nav>
 *     <div ref={usersRef} id="users">...</div>
 *     <div ref={logsRef} id="logs">...</div>
 *   </>
 * );
 * ```
 */
export function useSectionHash(options: UseSectionHashOptions): UseSectionHashResult {
  const { sections, threshold = 0.5 } = options;

  const [activeSection, setActiveSection] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.slice(1);
    return hash && hash in sections ? hash : null;
  });

  // Scroll to section from URL hash on mount.
  const scrolledOnMountRef = React.useRef(false);
  React.useEffect(() => {
    if (scrolledOnMountRef.current) return;
    scrolledOnMountRef.current = true;

    const hash = window.location.hash.slice(1);
    if (!hash || !(hash in sections)) return;

    const el = sections[hash]?.current;
    if (!el) return;

    // Defer to let the page render first.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [sections]);

  // Observe sections and update hash to the most visible one.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ratioMapRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    const entries = Object.entries(sections);
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (ioEntries) => {
        for (const entry of ioEntries) {
          const id = (entry.target as HTMLElement).id || findSectionId(entry.target, sections);
          if (id) {
            ratioMapRef.current.set(id, entry.intersectionRatio);
          }
        }

        // Debounce hash update to avoid thrashing during fast scroll.
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          let bestId: string | null = null;
          let bestRatio = 0;
          for (const [id, ratio] of ratioMapRef.current) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          }
          if (bestId && bestRatio > 0) {
            setActiveSection(bestId);
            // Update hash without triggering a scroll.
            const newHash = `#${bestId}`;
            if (window.location.hash !== newHash) {
              window.history.replaceState(window.history.state, '', newHash);
            }
          }
        }, SCROLL_DEBOUNCE_MS);
      },
      { threshold: [0, threshold, 1] },
    );

    for (const [_, ref] of entries) {
      if (ref.current) observer.observe(ref.current);
    }

    return () => {
      clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, [sections, threshold]);

  const scrollToSection = React.useCallback(
    (sectionId: string) => {
      const ref = sections[sectionId];
      if (!ref?.current) return;

      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
      window.history.replaceState(window.history.state, '', `#${sectionId}`);
    },
    [sections],
  );

  return { activeSection, scrollToSection };
}

/** Find the section ID for an observed element by matching against refs. */
function findSectionId(
  element: Element,
  sections: Record<string, React.RefObject<HTMLElement | null>>,
): string | null {
  for (const [id, ref] of Object.entries(sections)) {
    if (ref.current === element) return id;
  }
  return null;
}
