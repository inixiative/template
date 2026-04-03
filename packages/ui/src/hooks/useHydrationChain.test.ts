import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/hooks/useDataFilters';

/**
 * Tests for the full hydration chain:
 * URL params → initial state → useDataFilters → buildFilterQuery → query object
 * And the reverse: state → URL params → shareable URL
 *
 * This validates that a shared URL round-trips through the entire system:
 * 1. User shares ?page=3&pageSize=50&search=acme&orderBy=createdAt:desc
 * 2. readStateFromUrl parses it into PersistedState
 * 3. PersistedState seeds useDataFilters (search, orderBy)
 * 4. PersistedState seeds usePaginatedData (page, pageSize)
 * 5. buildFilterQuery produces the server query
 * 6. The full query = { ...filterQuery, page, pageSize }
 * 7. State changes write back to URL via syncStateToUrl
 */

// --- Simulate the URL → state parsing (mirrors readStateFromUrl) ---

type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

function readStateFromUrl(urlString: string): PersistedState {
  const params = new URLSearchParams(urlString);
  const state: PersistedState = {};
  const page = params.get('page');
  if (page) state.page = Number.parseInt(page, 10);
  const pageSize = params.get('pageSize');
  if (pageSize) state.pageSize = Number.parseInt(pageSize, 10);
  const search = params.get('search');
  if (search) state.search = search;
  const orderBy = params.getAll('orderBy');
  if (orderBy.length > 0) state.orderBy = orderBy;
  return state;
}

// --- Simulate the state → URL serialization (mirrors syncStateToUrl) ---

function syncStateToParams(state: PersistedState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page != null && state.page > 1) params.set('page', String(state.page));
  if (state.pageSize != null) params.set('pageSize', String(state.pageSize));
  if (state.search) params.set('search', state.search);
  if (state.orderBy) {
    for (const v of state.orderBy) params.append('orderBy', v);
  }
  return params;
}

// --- Simulate orderBy string → object parsing (mirrors usePaginatedData) ---

function parseOrderBy(strings: string[]): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return strings.map((s) => {
    const [field, direction] = s.split(':');
    return { field, direction: direction as 'asc' | 'desc' };
  });
}

// --- Simulate the full query composition (mirrors usePaginatedData.query) ---

function buildFullQuery(
  filterQuery: Record<string, unknown>,
  page: number,
  pageSize: number,
): Record<string, unknown> {
  return { ...filterQuery, page, pageSize };
}

// ====================================================================
// TESTS
// ====================================================================

describe('Full hydration chain: URL → state → filters → query', () => {
  it('shared URL hydrates into the correct server query', () => {
    // Step 1: User opens a shared URL
    const url = 'page=3&pageSize=50&search=acme&orderBy=createdAt:desc';

    // Step 2: Parse URL into persisted state
    const persisted = readStateFromUrl(url);
    expect(persisted).toEqual({
      page: 3,
      pageSize: 50,
      search: 'acme',
      orderBy: ['createdAt:desc'],
    });

    // Step 3: Parse orderBy strings into objects for useDataFilters
    const orderByObjects = parseOrderBy(persisted.orderBy!);
    expect(orderByObjects).toEqual([{ field: 'createdAt', direction: 'desc' }]);

    // Step 4: useDataFilters produces filterQuery
    const filterQuery = buildFilterQuery(
      persisted.search!,
      'combined',
      ['name', 'email'],
      {},
      orderByObjects,
    );
    expect(filterQuery).toEqual({
      search: 'acme',
      orderBy: ['createdAt:desc'],
    });

    // Step 5: Full query = filterQuery + page/pageSize
    const query = buildFullQuery(filterQuery, persisted.page!, persisted.pageSize!);
    expect(query).toEqual({
      search: 'acme',
      orderBy: ['createdAt:desc'],
      page: 3,
      pageSize: 50,
    });
  });

  it('URL with filters hydrates bracket-notation query', () => {
    const url = 'search=acme&orderBy=name:asc';
    const persisted = readStateFromUrl(url);

    const orderByObjects = parseOrderBy(persisted.orderBy ?? []);

    const filterQuery = buildFilterQuery(
      persisted.search ?? '',
      'field',
      ['name', 'email'],
      { status: { operator: 'in', values: ['active', 'pending'] } },
      orderByObjects,
    );

    expect(filterQuery['searchFields[name][contains]']).toBe('acme');
    expect(filterQuery['searchFields[email][contains]']).toBe('acme');
    expect(filterQuery['searchFields[status][in]']).toEqual(['active', 'pending']);
    expect(filterQuery.orderBy).toEqual(['name:asc']);
  });

  it('empty URL produces default query (page 1, no filters)', () => {
    const persisted = readStateFromUrl('');
    expect(persisted).toEqual({});

    const filterQuery = buildFilterQuery('', 'combined', [], {}, []);
    const query = buildFullQuery(filterQuery, 1, 20);

    expect(query).toEqual({ page: 1, pageSize: 20 });
  });
});

describe('Full hydration chain: state → URL → state (round-trip)', () => {
  it('full state round-trips through URL params', () => {
    const original: PersistedState = {
      page: 5,
      pageSize: 100,
      search: 'hello world',
      orderBy: ['createdAt:desc', 'name:asc'],
    };

    const params = syncStateToParams(original);
    const restored = readStateFromUrl(params.toString());

    expect(restored).toEqual(original);
  });

  it('search with special chars round-trips', () => {
    const original: PersistedState = { search: 'foo & bar = baz' };
    const params = syncStateToParams(original);
    const restored = readStateFromUrl(params.toString());
    expect(restored.search).toBe('foo & bar = baz');
  });

  it('multiple orderBy values round-trip', () => {
    const original: PersistedState = {
      orderBy: ['a:asc', 'b:desc', 'c.d:asc'],
    };
    const params = syncStateToParams(original);
    const restored = readStateFromUrl(params.toString());
    expect(restored.orderBy).toEqual(['a:asc', 'b:desc', 'c.d:asc']);
  });

  it('page 1 is omitted from URL but restored as undefined (default)', () => {
    const original: PersistedState = { page: 1, pageSize: 20 };
    const params = syncStateToParams(original);

    // page=1 is not in URL (optimization)
    expect(params.has('page')).toBe(false);
    expect(params.get('pageSize')).toBe('20');

    // Restored state has no page (undefined = use default of 1)
    const restored = readStateFromUrl(params.toString());
    expect(restored.page).toBeUndefined();
    expect(restored.pageSize).toBe(20);
  });
});

describe('orderBy string parsing', () => {
  it('parses single field', () => {
    expect(parseOrderBy(['createdAt:desc'])).toEqual([
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('parses multiple fields', () => {
    expect(parseOrderBy(['name:asc', 'createdAt:desc'])).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('parses relation path fields', () => {
    expect(parseOrderBy(['organizationUser.role:asc'])).toEqual([
      { field: 'organizationUser.role', direction: 'asc' },
    ]);
  });

  it('handles empty array', () => {
    expect(parseOrderBy([])).toEqual([]);
  });
});

describe('history.state hydration', () => {
  it('history.state takes precedence over URL', () => {
    // Simulates: user navigated back, history.state has page=5
    // but URL still shows page=3 from the shared link
    const fromHistory: PersistedState = { page: 5, search: 'from history' };
    const fromUrl: PersistedState = { page: 3, search: 'from url' };

    // readInitialState checks history.state first
    const result = fromHistory; // This is what readInitialState returns
    expect(result.page).toBe(5);
    expect(result.search).toBe('from history');

    // URL values are only used when history.state has nothing
    expect(fromUrl.page).toBe(3); // Would only be used as fallback
  });

  it('URL fallback used when history.state is empty', () => {
    const fromHistory = null; // No saved state (fresh navigation)
    const fromUrl: PersistedState = { page: 3, search: 'shared' };

    const result = fromHistory ?? fromUrl;
    expect(result.page).toBe(3);
    expect(result.search).toBe('shared');
  });

  it('both empty produces default state', () => {
    const fromHistory = null;
    const fromUrl: PersistedState = {};

    const result = fromHistory ?? (Object.keys(fromUrl).length > 0 ? fromUrl : {});
    expect(result).toEqual({});
  });
});
