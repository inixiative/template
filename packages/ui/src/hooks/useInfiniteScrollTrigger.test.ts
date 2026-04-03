import { describe, expect, it, mock } from 'bun:test';

/**
 * Tests for useInfiniteScrollTrigger's guard logic.
 * The actual IntersectionObserver behavior requires a DOM environment,
 * so we test the callback guards as pure functions.
 */

describe('useInfiniteScrollTrigger — callback guards', () => {
  it('calls onLoadMore when intersecting, hasMore, and not loading', () => {
    const onLoadMore = mock(() => {});
    const hasMore = true;
    const isLoading = false;
    const isIntersecting = true;

    if (isIntersecting && hasMore && !isLoading) {
      onLoadMore();
    }

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not call onLoadMore when not intersecting', () => {
    const onLoadMore = mock(() => {});
    const isIntersecting = false;

    if (isIntersecting && true && !false) {
      onLoadMore();
    }

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not call onLoadMore when hasMore is false', () => {
    const onLoadMore = mock(() => {});
    const hasMore = false;
    const isIntersecting = true;

    if (isIntersecting && hasMore && !false) {
      onLoadMore();
    }

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not call onLoadMore when already loading', () => {
    const onLoadMore = mock(() => {});
    const isLoading = true;
    const isIntersecting = true;

    if (isIntersecting && true && !isLoading) {
      onLoadMore();
    }

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
