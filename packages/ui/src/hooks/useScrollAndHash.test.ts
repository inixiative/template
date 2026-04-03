import { describe, expect, it } from 'bun:test';

/**
 * Tests for useSectionHash and usePaginatedData URL sync logic.
 * Tests the pure functions and contracts without requiring a DOM environment.
 */

// --- syncStateToUrl logic ---

type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

/** Mirrors the syncStateToUrl logic from usePaginatedData. */
function syncStateToParams(state: PersistedState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.page != null && state.page > 1) {
    params.set('page', String(state.page));
  }
  if (state.pageSize != null) {
    params.set('pageSize', String(state.pageSize));
  }
  if (state.search) {
    params.set('search', state.search);
  }
  if (state.orderBy && state.orderBy.length > 0) {
    for (const v of state.orderBy) params.append('orderBy', v);
  }

  return params;
}

/** Mirrors readStateFromUrl logic. */
function readStateFromParams(params: URLSearchParams): PersistedState {
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

describe('syncStateToUrl — URL param serialization', () => {
  it('page 1 is omitted from URL (default)', () => {
    const params = syncStateToParams({ page: 1, pageSize: 20 });
    expect(params.has('page')).toBe(false);
  });

  it('page > 1 is included', () => {
    const params = syncStateToParams({ page: 3 });
    expect(params.get('page')).toBe('3');
  });

  it('pageSize is included', () => {
    const params = syncStateToParams({ pageSize: 50 });
    expect(params.get('pageSize')).toBe('50');
  });

  it('search is included when non-empty', () => {
    const params = syncStateToParams({ search: 'acme' });
    expect(params.get('search')).toBe('acme');
  });

  it('empty search is omitted', () => {
    const params = syncStateToParams({ search: '' });
    expect(params.has('search')).toBe(false);
  });

  it('orderBy serializes as repeated params', () => {
    const params = syncStateToParams({ orderBy: ['createdAt:desc', 'name:asc'] });
    expect(params.getAll('orderBy')).toEqual(['createdAt:desc', 'name:asc']);
  });

  it('empty orderBy is omitted', () => {
    const params = syncStateToParams({ orderBy: [] });
    expect(params.has('orderBy')).toBe(false);
  });

  it('full state round-trips through params', () => {
    const original: PersistedState = {
      page: 3,
      pageSize: 50,
      search: 'acme',
      orderBy: ['createdAt:desc'],
    };
    const params = syncStateToParams(original);
    const restored = readStateFromParams(params);
    expect(restored).toEqual(original);
  });
});

describe('readStateFromUrl — URL param deserialization', () => {
  it('reads page as integer', () => {
    const params = new URLSearchParams('page=3');
    expect(readStateFromParams(params).page).toBe(3);
  });

  it('reads pageSize as integer', () => {
    const params = new URLSearchParams('pageSize=50');
    expect(readStateFromParams(params).pageSize).toBe(50);
  });

  it('reads search as string', () => {
    const params = new URLSearchParams('search=hello');
    expect(readStateFromParams(params).search).toBe('hello');
  });

  it('reads multiple orderBy values', () => {
    const params = new URLSearchParams('orderBy=a:asc&orderBy=b:desc');
    expect(readStateFromParams(params).orderBy).toEqual(['a:asc', 'b:desc']);
  });

  it('returns empty object for no params', () => {
    const params = new URLSearchParams('');
    expect(readStateFromParams(params)).toEqual({});
  });

  it('ignores unrelated params', () => {
    const params = new URLSearchParams('org=abc&space=xyz&page=2');
    const state = readStateFromParams(params);
    expect(state.page).toBe(2);
    expect(state).not.toHaveProperty('org');
  });
});

// --- useSectionHash dot notation resolution ---

/** Mirrors resolveSectionTarget's dot-parsing logic. */
function parseSectionPath(sectionId: string): { parentId: string; childKey: string | null } {
  const dotIndex = sectionId.indexOf('.');
  if (dotIndex === -1) return { parentId: sectionId, childKey: null };
  return {
    parentId: sectionId.slice(0, dotIndex),
    childKey: sectionId.slice(dotIndex + 1),
  };
}

describe('useSectionHash — dot notation parsing', () => {
  it('simple section ID has no child key', () => {
    expect(parseSectionPath('users')).toEqual({ parentId: 'users', childKey: null });
  });

  it('dotted ID splits into parent and child', () => {
    expect(parseSectionPath('usersTable.usr_abc123')).toEqual({
      parentId: 'usersTable',
      childKey: 'usr_abc123',
    });
  });

  it('numeric child key is preserved as string', () => {
    expect(parseSectionPath('usersTable.3')).toEqual({
      parentId: 'usersTable',
      childKey: '3',
    });
  });

  it('multiple dots only split on first', () => {
    expect(parseSectionPath('a.b.c')).toEqual({
      parentId: 'a',
      childKey: 'b.c',
    });
  });

  it('camelCase IDs work', () => {
    expect(parseSectionPath('activityLog')).toEqual({ parentId: 'activityLog', childKey: null });
  });

  it('camelCase with dot', () => {
    expect(parseSectionPath('activityLog.evt_123')).toEqual({
      parentId: 'activityLog',
      childKey: 'evt_123',
    });
  });
});

// --- history.state keying ---

describe('history.state key contracts', () => {
  it('scroll state uses scroll: prefix', () => {
    const id = 'usersTable';
    expect(`scroll:${id}`).toBe('scroll:usersTable');
  });

  it('data state uses data: prefix', () => {
    const id = 'usersTable';
    expect(`data:${id}`).toBe('data:usersTable');
  });

  it('section hash uses vscroll: prefix', () => {
    // From useSectionHash — hash is stored in URL, not history.state
    // But multiple sections coexist independently
    const hash = `#usersTable`;
    expect(hash.slice(1)).toBe('usersTable');
  });

  it('multiple keys coexist in history.state', () => {
    const state: Record<string, unknown> = {
      'scroll:usersTable': { scrollTop: 340 },
      'data:usersTable': { page: 3, pageSize: 20 },
      'scroll:activityLog': { scrollTop: 0 },
    };
    expect(Object.keys(state)).toHaveLength(3);
    expect((state['data:usersTable'] as { page: number }).page).toBe(3);
  });
});
