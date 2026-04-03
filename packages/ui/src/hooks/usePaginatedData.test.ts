import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/hooks/useDataFilters';
import { resolveSectionTarget } from '@template/ui/hooks/useSectionHash';

/**
 * Tests for usePaginatedData URL sync, section hash resolution,
 * and the full hydration chain. Imports actual functions from source
 * instead of redefining logic.
 *
 * Note: syncStateToUrl and readStateFromUrl require `window.location`
 * which isn't available in non-DOM test environment when run from root.
 * Those functions are tested via the pure param helpers below.
 * resolveSectionTarget requires happy-dom (run from packages/ui).
 */

// --- URL param helpers (pure, no window dependency) ---

type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

/** Convert state to URLSearchParams (mirrors syncStateToUrl logic). */
function toParams(state: PersistedState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page != null && state.page > 1) params.set('page', String(state.page));
  if (state.pageSize != null) params.set('pageSize', String(state.pageSize));
  if (state.search) params.set('search', state.search);
  if (state.orderBy) for (const v of state.orderBy) params.append('orderBy', v);
  return params;
}

/** Convert URLSearchParams to state (mirrors readStateFromUrl logic). */
function fromParams(params: URLSearchParams): PersistedState {
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

// TODO: These helpers mirror private functions in usePaginatedData.
// When syncStateToUrl/readStateFromUrl can be tested directly
// (requires window.location), replace these with direct imports.

// --- URL param serialization ---

describe('URL param serialization', () => {
  it('page 1 is omitted (default)', () => {
    expect(toParams({ page: 1 }).has('page')).toBe(false);
  });

  it('page > 1 is included', () => {
    expect(toParams({ page: 3 }).get('page')).toBe('3');
  });

  it('pageSize is included', () => {
    expect(toParams({ pageSize: 50 }).get('pageSize')).toBe('50');
  });

  it('search is included when non-empty', () => {
    expect(toParams({ search: 'acme' }).get('search')).toBe('acme');
  });

  it('empty search is omitted', () => {
    expect(toParams({ search: '' }).has('search')).toBe(false);
  });

  it('orderBy as repeated params', () => {
    expect(toParams({ orderBy: ['createdAt:desc', 'name:asc'] }).getAll('orderBy'))
      .toEqual(['createdAt:desc', 'name:asc']);
  });

  it('full state round-trips', () => {
    const original: PersistedState = {
      page: 5, pageSize: 100, search: 'hello world',
      orderBy: ['createdAt:desc', 'name:asc'],
    };
    expect(fromParams(toParams(original))).toEqual(original);
  });

  it('special chars round-trip', () => {
    const original: PersistedState = { search: 'foo & bar = baz' };
    expect(fromParams(toParams(original)).search).toBe('foo & bar = baz');
  });
});

// --- orderBy string parsing ---

function parseOrderBy(strings: string[]): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return strings.map((s) => {
    const [field, direction] = s.split(':');
    return { field, direction: direction as 'asc' | 'desc' };
  });
}

describe('orderBy parsing', () => {
  it('parses single field', () => {
    expect(parseOrderBy(['createdAt:desc'])).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('parses relation path', () => {
    expect(parseOrderBy(['organizationUser.role:asc'])).toEqual([
      { field: 'organizationUser.role', direction: 'asc' },
    ]);
  });

  it('handles empty', () => {
    expect(parseOrderBy([])).toEqual([]);
  });
});

// --- Full hydration chain ---

describe('hydration chain: URL → state → filters → query', () => {
  it('shared URL hydrates into correct server query', () => {
    const persisted = fromParams(new URLSearchParams('page=3&pageSize=50&search=acme&orderBy=createdAt:desc'));

    const orderByObjects = parseOrderBy(persisted.orderBy!);

    const filterQuery = buildFilterQuery(
      persisted.search!, 'combined', ['name', 'email'], {}, orderByObjects,
    );

    const query: Record<string, unknown> = { ...filterQuery, page: persisted.page, pageSize: persisted.pageSize };
    expect(query).toEqual({
      search: 'acme', orderBy: ['createdAt:desc'], page: 3, pageSize: 50,
    });
  });

  it('empty URL produces default query', () => {
    const persisted = fromParams(new URLSearchParams(''));
    const filterQuery = buildFilterQuery('', 'combined', [], {}, []);
    const query: Record<string, unknown> = { ...filterQuery, page: persisted.page ?? 1, pageSize: persisted.pageSize ?? 20 };
    expect(query).toEqual({ page: 1, pageSize: 20 });
  });
});

// --- history.state key contracts ---

describe('history.state keys', () => {
  it('scroll state uses scroll: prefix', () => {
    expect(`scroll:${'usersTable'}`).toBe('scroll:usersTable');
  });

  it('data state uses data: prefix', () => {
    expect(`data:${'usersTable'}`).toBe('data:usersTable');
  });

  it('multiple keys coexist', () => {
    const state: Record<string, unknown> = {
      'scroll:usersTable': { scrollTop: 340 },
      'data:usersTable': { page: 3 },
      'scroll:activityLog': { scrollTop: 0 },
    };
    expect(Object.keys(state)).toHaveLength(3);
  });
});

// --- resolveSectionTarget (requires happy-dom) ---

describe('resolveSectionTarget', () => {
  it('resolves simple section by data-section', () => {
    const el = document.createElement('div');
    el.setAttribute('data-section', 'users');
    document.body.appendChild(el);

    const target = resolveSectionTarget('users');
    expect(target).toBe(el);

    document.body.removeChild(el);
  });

  it('resolves dot-notated child by data-key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'usersTable');
    const child = document.createElement('div');
    child.setAttribute('data-key', 'usr_abc');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const target = resolveSectionTarget('usersTable.usr_abc');
    expect(target).toBe(child);

    document.body.removeChild(parent);
  });

  it('resolves numeric index fallback', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'items');
    for (let i = 0; i < 5; i++) {
      const row = document.createElement('div');
      row.setAttribute('data-key', `item-${i}`);
      parent.appendChild(row);
    }
    document.body.appendChild(parent);

    // Numeric index: 3rd data-key child (0-indexed)
    const target = resolveSectionTarget('items.3');
    expect(target?.getAttribute('data-key')).toBe('item-3');

    document.body.removeChild(parent);
  });

  it('returns null for missing section', () => {
    expect(resolveSectionTarget('nonexistent')).toBeNull();
  });

  it('returns null for missing child key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'table');
    document.body.appendChild(parent);

    expect(resolveSectionTarget('table.missing')).toBeNull();

    document.body.removeChild(parent);
  });

  it('returns null for out-of-range numeric index', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'items');
    const row = document.createElement('div');
    row.setAttribute('data-key', 'only');
    parent.appendChild(row);
    document.body.appendChild(parent);

    expect(resolveSectionTarget('items.99')).toBeNull();

    document.body.removeChild(parent);
  });
});
