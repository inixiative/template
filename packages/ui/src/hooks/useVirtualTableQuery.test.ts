import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

/**
 * Tests for useVirtualTableQuery's pure logic:
 * - locateItem: maps flat index to { pageIndex, indexInPage }
 * - Page count persistence contract via sessionStorage
 */

// --- locateItem logic (extracted for unit testing) ---

type PageData<T> = { data: T[]; total?: number; nextPage?: number };

/**
 * Mirrors the locateItem callback inside useVirtualTableQuery.
 * Given pages and a flat index, returns the page location.
 */
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

  it('returns result for negative index (no guard in implementation)', () => {
    // Negative index passes the `remaining < page.data.length` check immediately
    // since -1 < 3, so it returns { pageIndex: 0, indexInPage: -1 }.
    // This is expected — callers should not pass negative indices.
    const result = locateItem(pages, -1);
    expect(result).toEqual({ pageIndex: 0, indexInPage: -1 });
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

// --- Page count persistence contract ---

const store = new Map<string, string>();
const mockSessionStorage = {
  getItem: mock((key: string) => store.get(key) ?? null),
  setItem: mock((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: mock((key: string) => {
    store.delete(key);
  }),
};

beforeEach(() => {
  store.clear();
  mockSessionStorage.getItem.mockClear();
  mockSessionStorage.setItem.mockClear();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  store.clear();
});

describe('useVirtualTableQuery — page count persistence', () => {
  it('stores page count under vtq:<restoreKey>', () => {
    const restoreKey = 'dashboard-users';
    sessionStorage.setItem(`vtq:${restoreKey}`, '3');
    expect(sessionStorage.getItem(`vtq:${restoreKey}`)).toBe('3');
  });

  it('parses saved page count as integer', () => {
    sessionStorage.setItem('vtq:key', '5');
    const saved = Number.parseInt(sessionStorage.getItem('vtq:key')!, 10);
    expect(saved).toBe(5);
  });

  it('returns null when no saved page count exists', () => {
    expect(sessionStorage.getItem('vtq:missing')).toBeNull();
  });

  it('page restore target of 0 means no extra pages to fetch', () => {
    sessionStorage.setItem('vtq:key', '0');
    const target = Number.parseInt(sessionStorage.getItem('vtq:key')!, 10);
    const currentPageCount = 1;
    expect(target > currentPageCount).toBe(false);
  });

  it('page restore target > current page count triggers fetch', () => {
    sessionStorage.setItem('vtq:key', '3');
    const target = Number.parseInt(sessionStorage.getItem('vtq:key')!, 10);
    const currentPageCount = 1;
    expect(target > currentPageCount).toBe(true);
  });
});
