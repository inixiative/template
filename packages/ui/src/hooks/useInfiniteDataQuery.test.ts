import { describe, expect, it } from 'bun:test';
import { type InfiniteDataPage, locateItemInPages } from '@template/ui/hooks/useInfiniteDataQuery';

describe('locateItemInPages', () => {
  const pages: InfiniteDataPage<string>[] = [
    { data: ['a', 'b', 'c'], total: 10, nextPage: 1 },
    { data: ['d', 'e'], total: 10, nextPage: 2 },
    { data: ['f', 'g', 'h', 'i'], total: 10 },
  ];

  it('locates item in first page', () => {
    expect(locateItemInPages(pages, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItemInPages(pages, 2)).toEqual({ pageIndex: 0, indexInPage: 2 });
  });

  it('locates item in second page', () => {
    expect(locateItemInPages(pages, 3)).toEqual({ pageIndex: 1, indexInPage: 0 });
    expect(locateItemInPages(pages, 4)).toEqual({ pageIndex: 1, indexInPage: 1 });
  });

  it('locates item in third page', () => {
    expect(locateItemInPages(pages, 5)).toEqual({ pageIndex: 2, indexInPage: 0 });
    expect(locateItemInPages(pages, 8)).toEqual({ pageIndex: 2, indexInPage: 3 });
  });

  it('returns null for index beyond all pages', () => {
    expect(locateItemInPages(pages, 9)).toBeNull();
    expect(locateItemInPages(pages, 100)).toBeNull();
  });

  it('returns null for negative index', () => {
    expect(locateItemInPages(pages, -1)).toBeNull();
  });

  it('returns null for empty pages array', () => {
    expect(locateItemInPages([], 0)).toBeNull();
  });

  it('handles single-page data', () => {
    const single: InfiniteDataPage<string>[] = [{ data: ['x', 'y'], total: 2 }];
    expect(locateItemInPages(single, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItemInPages(single, 1)).toEqual({ pageIndex: 0, indexInPage: 1 });
    expect(locateItemInPages(single, 2)).toBeNull();
  });

  it('handles pages with varying sizes', () => {
    const varied: InfiniteDataPage<number>[] = [
      { data: [1], total: 6 },
      { data: [2, 3, 4], total: 6 },
      { data: [5, 6], total: 6 },
    ];
    expect(locateItemInPages(varied, 0)).toEqual({ pageIndex: 0, indexInPage: 0 });
    expect(locateItemInPages(varied, 1)).toEqual({ pageIndex: 1, indexInPage: 0 });
    expect(locateItemInPages(varied, 3)).toEqual({ pageIndex: 1, indexInPage: 2 });
    expect(locateItemInPages(varied, 4)).toEqual({ pageIndex: 2, indexInPage: 0 });
    expect(locateItemInPages(varied, 5)).toEqual({ pageIndex: 2, indexInPage: 1 });
    expect(locateItemInPages(varied, 6)).toBeNull();
  });
});
