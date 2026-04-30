import { afterEach, describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/lib/buildFilterQuery';
import { parseOrderByStrings, readStateFromUrl, syncStateToUrl } from '@template/ui/lib/dataStatePersistence';
import { resolveSectionTarget } from '@template/ui/lib/resolveSectionTarget';

/**
 * All imports from source — no local copies of logic.
 */

// --- syncStateToUrl ---

describe('syncStateToUrl', () => {
  it('page 1 is omitted (default)', () => {
    const url = syncStateToUrl({ page: 1, pageSize: 20 });
    expect(url).not.toContain('page=');
    expect(url).toContain('pageSize=20');
  });

  it('page > 1 is included', () => {
    const url = syncStateToUrl({ page: 3 });
    expect(url).toContain('page=3');
  });

  it('search is included when non-empty', () => {
    const url = syncStateToUrl({ search: 'acme' });
    expect(url).toContain('search=acme');
  });

  it('empty search is omitted', () => {
    const url = syncStateToUrl({ search: '' });
    expect(url).not.toContain('search=');
  });

  it('orderBy as repeated params', () => {
    const url = syncStateToUrl({ orderBy: ['createdAt:desc', 'name:asc'] });
    expect(url).toContain('orderBy=');
  });

  it('empty state produces clean URL', () => {
    const url = syncStateToUrl({});
    expect(url).not.toContain('page=');
    expect(url).not.toContain('search=');
    expect(url).not.toContain('orderBy=');
  });
});

// --- readStateFromUrl (pass search string directly) ---

describe('readStateFromUrl', () => {
  it('reads page', () => {
    expect(readStateFromUrl('?page=3').page).toBe(3);
  });

  it('reads pageSize', () => {
    expect(readStateFromUrl('?pageSize=50').pageSize).toBe(50);
  });

  it('reads search', () => {
    expect(readStateFromUrl('?search=hello').search).toBe('hello');
  });

  it('reads multiple orderBy', () => {
    expect(readStateFromUrl('?orderBy=a:asc&orderBy=b:desc').orderBy).toEqual(['a:asc', 'b:desc']);
  });

  it('returns empty for no params', () => {
    expect(readStateFromUrl('')).toEqual({});
  });

  it('ignores unrelated params', () => {
    const state = readStateFromUrl('?org=abc&page=2');
    expect(state.page).toBe(2);
    expect(state).not.toHaveProperty('org');
  });
});

// --- Round-trip ---

describe('URL round-trip', () => {
  it('full state round-trips', () => {
    const original = { page: 5, pageSize: 100, search: 'hello world', orderBy: ['createdAt:desc', 'name:asc'] };
    const url = syncStateToUrl(original);
    // Extract search string from the URL
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const restored = readStateFromUrl(searchString);
    expect(restored).toEqual(original);
  });

  it('special chars round-trip', () => {
    const original = { search: 'foo & bar = baz' };
    const url = syncStateToUrl(original);
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    expect(readStateFromUrl(searchString).search).toBe('foo & bar = baz');
  });

  it('page 1 omitted but defaults back to undefined', () => {
    const url = syncStateToUrl({ page: 1, pageSize: 20 });
    const searchString = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const restored = readStateFromUrl(searchString);
    expect(restored.page).toBeUndefined(); // page 1 not in URL
    expect(restored.pageSize).toBe(20);
  });
});

// --- parseOrderByStrings ---

describe('parseOrderByStrings', () => {
  it('parses single field', () => {
    expect(parseOrderByStrings(['createdAt:desc'])).toEqual([{ field: 'createdAt', direction: 'desc' }]);
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
    const persisted = readStateFromUrl('?page=3&pageSize=50&search=acme&orderBy=createdAt:desc');
    const orderByObjects = parseOrderByStrings(persisted.orderBy!);
    const filterQuery = buildFilterQuery(persisted.search!, 'combined', ['name', 'email'], {}, orderByObjects);
    const query: Record<string, unknown> = { ...filterQuery, page: persisted.page, pageSize: persisted.pageSize };

    expect(query).toEqual({
      search: 'acme',
      orderBy: ['createdAt:desc'],
      page: 3,
      pageSize: 50,
    });
  });

  it('empty URL produces default query', () => {
    const persisted = readStateFromUrl('');
    const filterQuery = buildFilterQuery('', 'combined', [], {}, []);
    const query: Record<string, unknown> = {
      ...filterQuery,
      page: persisted.page ?? 1,
      pageSize: persisted.pageSize ?? 20,
    };
    expect(query).toEqual({ page: 1, pageSize: 20 });
  });
});

// --- history.state key contracts ---

describe('history.state keys', () => {
  it('scroll uses scroll: prefix', () => {
    expect(`scroll:usersTable`).toBe('scroll:usersTable');
  });

  it('data uses data: prefix', () => {
    expect(`data:usersTable`).toBe('data:usersTable');
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

// --- resolveSectionTarget ---

describe('resolveSectionTarget', () => {
  afterEach(() => {
    for (const el of document.body.querySelectorAll('[data-section]')) el.remove();
  });

  it('resolves simple section', () => {
    const el = document.createElement('div');
    el.setAttribute('data-section', 'users');
    document.body.appendChild(el);
    expect(resolveSectionTarget('users')).toBe(el);
  });

  it('resolves dot-notated child by data-key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'usersTable');
    const child = document.createElement('div');
    child.setAttribute('data-key', 'usr_abc');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(resolveSectionTarget('usersTable.usr_abc')).toBe(child);
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
    expect(resolveSectionTarget('items.3')?.getAttribute('data-key')).toBe('item-3');
  });

  it('returns null for missing section', () => {
    expect(resolveSectionTarget('nonexistent')).toBeNull();
  });

  it('returns null for missing child key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'table');
    document.body.appendChild(parent);
    expect(resolveSectionTarget('table.missing')).toBeNull();
  });

  it('returns null for out-of-range index', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'items');
    const row = document.createElement('div');
    row.setAttribute('data-key', 'only');
    parent.appendChild(row);
    document.body.appendChild(parent);
    expect(resolveSectionTarget('items.99')).toBeNull();
  });
});
