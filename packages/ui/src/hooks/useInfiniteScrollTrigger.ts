/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import * as React from 'react';

export type UseInfiniteScrollTriggerOptions = {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
};

export function useInfiniteScrollTrigger(options: UseInfiniteScrollTriggerOptions): React.RefCallback<HTMLElement> {
  const { onLoadMore, hasMore, isLoading, rootMargin = '200px' } = options;

  // Use refs so the IntersectionObserver callback always sees current values
  // without needing to disconnect/reconnect on every render.
  const onLoadMoreRef = React.useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const hasMoreRef = React.useRef(hasMore);
  hasMoreRef.current = hasMore;
  const isLoadingRef = React.useRef(isLoading);
  isLoadingRef.current = isLoading;

  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const elementRef = React.useRef<HTMLElement | null>(null);

  // Stable observer instance — created once, reused across element changes.
  React.useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !isLoadingRef.current) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin },
    );

    // Observe the current element if one was already set.
    if (elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [rootMargin]);

  // Ref callback: when the sentinel mounts/unmounts, update the observer.
  const sentinelRef = React.useCallback((node: HTMLElement | null) => {
    // Unobserve previous element.
    if (elementRef.current && observerRef.current) {
      observerRef.current.unobserve(elementRef.current);
    }

    elementRef.current = node;

    // Observe new element.
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  return sentinelRef;
}
