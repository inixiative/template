import { describe, expect, it } from 'bun:test';

/**
 * Tests for useInfiniteDataQuery's pure logic:
 * - locateItem: maps flat index to { pageIndex, indexInPage }
 */

type PageData<T> = { data: T[]; total?: number; nextPage?: number };

function locateItem<T>(pages: PageData<T>[], flatIndex: number): { pageIndex: number; indexInPage: number } | null {
  let remaining = flatIndex;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    if (remaining < page.data.length) {
      return { pageIndex, indexInPage: remaining };
    }
    remaining -= page.data.length;
  }
  return null;
}

describe('locateItem', () => {
  const pages: PageData<string>[] = [
    { data: ['a', 'b', 'c'], total: 10, nextPage: 1 },
    { data: ['d', 'e'], total: 10, nextPage: 2 },
    { data: ['f', 'g', 'h', 'i'], total: 10 },
  ];

  it('locates item in first page', () => {
    expect(locateItem(pages, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItem(pages, 2)).toEqual({ pageIndex: 0, indexInPage: 2 });
  });

  it('locates item in second page', () => {
    expect(locateItem(pages, 3)).toEqual({ pageIndex: 1, indexInPage: 0 });
    expect(locateItem(pages, 4)).toEqual({ pageIndex: 1, indexInPage: 1 });
  });

  it('locates item in third page', () => {
    expect(locateItem(pages, 5)).toEqual({ pageIndex: 2, indexInPage: 0 });
    expect(locateItem(pages, 8)).toEqual({ pageIndex: 2, indexInPage: 3 });
  });

  it('returns null for index beyond all pages', () => {
    expect(locateItem(pages, 9)).toBeNull();
    expect(locateItem(pages, 100)).toBeNull();
  });

  it('returns null for empty pages array', () => {
    expect(locateItem([], 0)).toBeNull();
  });

  it('handles single-page data', () => {
    const single: PageData<string>[] = [{ data: ['x', 'y'], total: 2 }];
    expect(locateItem(single, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItem(single, 1)).toEqual({ pageIndex: 0, indexInPage: 1 });
    expect(locateItem(single, 2)).toBeNull();
  });

  it('handles pages with varying sizes', () => {
    const varied: PageData<number>[] = [
      { data: [1], total: 6 },
      { data: [2, 3, 4], total: 6 },
      { data: [5, 6], total: 6 },
    ];
    expect(locateItem(varied, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItem(varied, 1)).toEqual({ pageIndex: 1, indexInPage: 0 });
    expect(locateItem(varied, 3)).toEqual({ pageIndex: 1, indexInPage: 2 });
    expect(locateItem(varied, 4)).toEqual({ pageIndex: 2, indexInPage: 0 });
    expect(locateItem(varied, 5)).toEqual({ pageIndex: 2, indexInPage: 1 });
    expect(locateItem(varied, 6)).toBeNull();
  });
});
