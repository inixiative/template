import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/lib/buildFilterQuery';
import {
  currentUrlWithListStateParams,
  listPageStateFromUrl,
  parseOrderByStrings,
} from '@template/ui/lib/dataStatePersistence';

describe('listPageStateFromUrl — page/pageSize hardening', () => {
  it('parses valid positive integers', () => {
    expect(listPageStateFromUrl('?page=3&pageSize=50')).toEqual({ page: 3, pageSize: 50 });
  });

  it('ignores non-numeric page/pageSize (NaN)', () => {
    expect(listPageStateFromUrl('?page=abc&pageSize=xyz')).toEqual({});
  });

  it('ignores zero and negative page/pageSize', () => {
    expect(listPageStateFromUrl('?page=0&pageSize=-5')).toEqual({});
  });

  it('carries search and orderBy through', () => {
    expect(listPageStateFromUrl('?search=hi&orderBy=name:asc')).toEqual({
      search: 'hi',
      orderBy: ['name:asc'],
    });
  });
});

describe('parseOrderByStrings — direction fallback', () => {
  it('keeps explicit asc and desc', () => {
    expect(parseOrderByStrings(['name:desc', 'age:asc'])).toEqual([
      { field: 'name', direction: 'desc' },
      { field: 'age', direction: 'asc' },
    ]);
  });

  it('falls back to asc for a missing or arbitrary direction', () => {
    expect(parseOrderByStrings(['name', 'age:sideways'])).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'age', direction: 'asc' },
    ]);
  });
});

// --- currentUrlWithListStateParams ---

describe('currentUrlWithListStateParams', () => {
  it('page 1 is omitted (default)', () => {
    const url = currentUrlWithListStateParams({ page: 1, pageSize: 20 });
    expect(url).not.toContain('page=');
    expect(url).toContain('pageSize=20');
  });

  it('page > 1 is included', () => {
    const url = currentUrlWithListStateParams({ page: 3 });
    expect(url).toContain('page=3');
  });

  it('search is included when non-empty', () => {
    const url = currentUrlWithListStateParams({ search: 'acme' });
    expect(url).toContain('search=acme');
  });

  it('empty search is omitted', () => {
    const url = currentUrlWithListStateParams({ search: '' });
    expect(url).not.toContain('search=');
  });

  it('orderBy as repeated params', () => {
    const url = currentUrlWithListStateParams({ orderBy: ['createdAt:desc', 'name:asc'] });
    expect(url).toContain('orderBy=');
  });

  it('empty state produces clean URL', () => {
    const url = currentUrlWithListStateParams({});
    expect(url).not.toContain('page=');
    expect(url).not.toContain('search=');
    expect(url).not.toContain('orderBy=');
  });
});

// --- listPageStateFromUrl (pass search string directly) ---

describe('listPageStateFromUrl', () => {
  it('reads page', () => {
    expect(listPageStateFromUrl('?page=3').page).toBe(3);
  });

  it('reads pageSize', () => {
    expect(listPageStateFromUrl('?pageSize=50').pageSize).toBe(50);
  });

  it('reads search', () => {
    expect(listPageStateFromUrl('?search=hello').search).toBe('hello');
  });

  it('reads multiple orderBy', () => {
    expect(listPageStateFromUrl('?orderBy=a:asc&orderBy=b:desc').orderBy).toEqual([
      'a:asc',
      'b:desc',
    ]);
  });

  it('returns empty for no params', () => {
    expect(listPageStateFromUrl('')).toEqual({});
  });

  it('ignores unrelated params', () => {
    const state = listPageStateFromUrl('?org=abc&page=2');
    expect(state.page).toBe(2);
    expect(state).not.toHaveProperty('org');
  });
});

// --- Round-trip ---

describe('URL round-trip', () => {
  it('full state round-trips', () => {
    const original = {
      page: 5,
      pageSize: 100,
      search: 'hello world',
      orderBy: ['createdAt:desc', 'name:asc'],
    };
    const url = currentUrlWithListStateParams(original);
    // Extract search string from the URL
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const restored = listPageStateFromUrl(searchString);
    expect(restored).toEqual(original);
  });

  it('special chars round-trip', () => {
    const original = { search: 'foo & bar = baz' };
    const url = currentUrlWithListStateParams(original);
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    expect(listPageStateFromUrl(searchString).search).toBe('foo & bar = baz');
  });

  it('page 1 omitted but defaults back to undefined', () => {
    const url = currentUrlWithListStateParams({ page: 1, pageSize: 20 });
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const restored = listPageStateFromUrl(searchString);
    expect(restored.page).toBeUndefined(); // page 1 not in URL
    expect(restored.pageSize).toBe(20);
  });
});

// --- parseOrderByStrings ---

describe('parseOrderByStrings', () => {
  it('parses single field', () => {
    expect(parseOrderByStrings(['createdAt:desc'])).toEqual([
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('parses multiple fields', () => {
    expect(parseOrderByStrings(['name:asc', 'createdAt:desc'])).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('parses relation path', () => {
    expect(parseOrderByStrings(['organizationUser.role:asc'])).toEqual([
      { field: 'organizationUser.role', direction: 'asc' },
    ]);
  });

  it('handles empty', () => {
    expect(parseOrderByStrings([])).toEqual([]);
  });
});

// --- Full hydration chain ---

describe('hydration chain: URL → filters → query', () => {
  it('shared URL hydrates into correct server query', () => {
    const persisted = listPageStateFromUrl(
      '?page=3&pageSize=50&search=acme&orderBy=createdAt:desc',
    );
    const orderByObjects = parseOrderByStrings(persisted.orderBy!);
    const filterQuery = buildFilterQuery(persisted.search!, ['name', 'email'], {}, orderByObjects);
    const query: Record<string, unknown> = {
      ...filterQuery,
      page: persisted.page,
      pageSize: persisted.pageSize,
    };

    expect(query).toEqual({
      search: 'acme',
      orderBy: ['createdAt:desc'],
      page: 3,
      pageSize: 50,
    });
  });

  it('empty URL produces default query', () => {
    const persisted = listPageStateFromUrl('');
    const filterQuery = buildFilterQuery('', [], {}, []);
    const query: Record<string, unknown> = {
      ...filterQuery,
      page: persisted.page ?? 1,
      pageSize: persisted.pageSize ?? 20,
    };
    expect(query).toEqual({ page: 1, pageSize: 20 });
  });
});
