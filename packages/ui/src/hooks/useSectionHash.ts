import * as React from 'react';

const SCROLL_DEBOUNCE_MS = 200;
const SECTION_ATTR = 'data-section';
const SECTION_SELECTOR = `[${SECTION_ATTR}]`;

export type UseSectionHashOptions = {
  /**
   * Whether hash tracking is enabled. Defaults to true.
   * Set to false to temporarily disable without unmounting.
   */
  enabled?: boolean;
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
 * Auto-discovers sections in the DOM and syncs the URL hash with the
 * most visible one. Mount once at the app root — no per-page wiring needed.
 *
 * Sections opt in by adding `data-section="section-id"` to any element:
 *
 *   <div data-section="users">...</div>
 *   <div data-section="activity">...</div>
 *
 * The hook uses a MutationObserver to detect sections as they mount/unmount,
 * and an IntersectionObserver to track which section is most visible.
 *
 * On mount: if the URL has a #hash matching a section, scrolls to it.
 * On scroll: updates the URL hash to the most visible section (debounced).
 * On navigation: new page's sections are auto-discovered as they mount.
 *
 * Usage (app root):
 * ```tsx
 * function App() {
 *   const { activeSection, scrollToSection } = useSectionHash();
 *   return <RouterProvider ... />;
 * }
 * ```
 *
 * Usage (any component):
 * ```tsx
 * <section data-section="users">
 *   <h2>Users</h2>
 *   <Table ... />
 * </section>
 * ```
 */
export function useSectionHash(options: UseSectionHashOptions = {}): UseSectionHashResult {
  const { enabled = true, threshold = 0.5 } = options;

  const [activeSection, setActiveSection] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.slice(1);
    return hash || null;
  });

  // Track intersection ratios for all observed sections.
  const ratioMapRef = React.useRef<Map<string, number>>(new Map());
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intersectionObserverRef = React.useRef<IntersectionObserver | null>(null);

  // Scroll to hash on mount.
  const scrolledOnMountRef = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || scrolledOnMountRef.current) return;
    scrolledOnMountRef.current = true;

    const hash = window.location.hash.slice(1);
    if (!hash) return;

    // Defer to let the page render sections first.
    requestAnimationFrame(() => {
      const el = document.querySelector(`[${SECTION_ATTR}="${CSS.escape(hash)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [enabled]);

  // Set up IntersectionObserver + MutationObserver for auto-discovery.
  React.useEffect(() => {
    if (!enabled) return;

    const onIntersection: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).getAttribute(SECTION_ATTR);
        if (id) {
          ratioMapRef.current.set(id, entry.intersectionRatio);
        }
      }

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
          const newHash = `#${bestId}`;
          if (window.location.hash !== newHash) {
            window.history.replaceState(window.history.state, '', newHash);
          }
        }
      }, SCROLL_DEBOUNCE_MS);
    };

    const io = new IntersectionObserver(onIntersection, {
      threshold: [0, threshold, 1],
    });
    intersectionObserverRef.current = io;

    // Observe all existing sections.
    const existing = document.querySelectorAll(SECTION_SELECTOR);
    for (const el of existing) {
      io.observe(el);
    }

    // Watch for sections being added/removed from the DOM.
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.hasAttribute(SECTION_ATTR)) {
              io.observe(node);
            }
            // Also check descendants (e.g. a subtree was added).
            for (const child of node.querySelectorAll(SECTION_SELECTOR)) {
              io.observe(child);
            }
          }
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            const id = node.getAttribute(SECTION_ATTR);
            if (id) {
              io.unobserve(node);
              ratioMapRef.current.delete(id);
            }
            for (const child of node.querySelectorAll(SECTION_SELECTOR)) {
              const childId = child.getAttribute(SECTION_ATTR);
              if (childId) {
                io.unobserve(child);
                ratioMapRef.current.delete(childId);
              }
            }
          }
        }
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timerRef.current);
      io.disconnect();
      mo.disconnect();
      intersectionObserverRef.current = null;
      ratioMapRef.current.clear();
    };
  }, [enabled, threshold]);

  const scrollToSection = React.useCallback(
    (sectionId: string) => {
      const el = document.querySelector(`[${SECTION_ATTR}="${CSS.escape(sectionId)}"]`);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
      window.history.replaceState(window.history.state, '', `#${sectionId}`);
    },
    [],
  );

  return { activeSection, scrollToSection };
}
