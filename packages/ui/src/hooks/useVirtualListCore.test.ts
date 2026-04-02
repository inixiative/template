import { describe, expect, it, mock } from 'bun:test';
import { buildScrollHandle } from '@template/ui/hooks/useVirtualListCore';

/**
 * Tests for buildScrollHandle — a pure function that creates
 * imperative scroll handles for VirtualTable and VirtualScroll.
 */

// Minimal mock of Virtualizer's scrollToIndex
function createMockVirtualizer() {
  const scrollToIndex = mock((_index: number, _options?: unknown) => {});
  return { scrollToIndex } as unknown as Parameters<typeof buildScrollHandle>[0];
}

type TestItem = { id: string; name: string };

const items: TestItem[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Charlie' },
];

const keyExtractor = (item: TestItem) => item.id;

describe('buildScrollHandle', () => {
  it('returns an object with scrollToIndex and scrollToItem', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    expect(typeof handle.scrollToIndex).toBe('function');
    expect(typeof handle.scrollToItem).toBe('function');
  });

  it('scrollToIndex delegates to virtualizer.scrollToIndex', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    handle.scrollToIndex(2, { align: 'center' } as never);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(2, { align: 'center' });
  });

  it('scrollToIndex passes options through', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    handle.scrollToIndex(0);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(0, undefined);
  });

  it('scrollToItem finds item by key and scrolls to its index', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    const found = handle.scrollToItem('b');
    expect(found).toBe(true);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1, { align: 'start' });
  });

  it('scrollToItem returns false for unknown key', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    const found = handle.scrollToItem('z');
    expect(found).toBe(false);
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it('scrollToItem finds the first item (index 0)', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    const found = handle.scrollToItem('a');
    expect(found).toBe(true);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' });
  });

  it('scrollToItem finds the last item', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, items, keyExtractor);

    const found = handle.scrollToItem('c');
    expect(found).toBe(true);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(2, { align: 'start' });
  });

  it('works with empty items array', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, [], keyExtractor);

    const found = handle.scrollToItem('a');
    expect(found).toBe(false);
  });

  it('works with single-item array', () => {
    const virtualizer = createMockVirtualizer();
    const handle = buildScrollHandle(virtualizer, [items[0]], keyExtractor);

    expect(handle.scrollToItem('a')).toBe(true);
    expect(handle.scrollToItem('b')).toBe(false);
  });
});
