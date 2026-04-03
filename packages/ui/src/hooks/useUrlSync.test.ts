import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/hooks/useDataFilters';

/**
 * Tests for the full query building pipeline:
 * buildFilterQuery → filter/sort serialization → final query object
 *
 * And URL param round-trip tests for the shareable URL feature.
 */

// --- buildFilterQuery comprehensive tests ---

describe('buildFilterQuery — filter serialization', () => {
  it('combined search produces top-level search param', () => {
    const q = buildFilterQuery('acme', 'combined', ['name', 'email'], {}, []);
    expect(q.search).toBe('acme');
    expect(Object.keys(q).filter((k) => k.startsWith('searchFields'))).toHaveLength(0);
  });

  it('field search produces per-field bracket params', () => {
    const q = buildFilterQuery('acme', 'field', ['name', 'email'], {}, []);
    expect(q['searchFields[name][contains]']).toBe('acme');
    expect(q['searchFields[email][contains]']).toBe('acme');
    expect(q.search).toBeUndefined();
  });

  it('combined search with no searchable fields produces nothing', () => {
    const q = buildFilterQuery('acme', 'combined', [], {}, []);
    expect(q.search).toBeUndefined();
  });

  it('admin mode uses filters prefix', () => {
    const q = buildFilterQuery('', 'combined', [], { status: { operator: 'in', values: ['active'] } }, [], true);
    expect(q['filters[status][in]']).toBe('active');
    expect(q['searchFields[status][in]']).toBeUndefined();
  });

  it('admin mode suppresses combined search', () => {
    const q = buildFilterQuery('acme', 'combined', ['name'], {}, [], true);
    expect(q.search).toBeUndefined();
  });

  it('non-admin uses searchFields prefix', () => {
    const q = buildFilterQuery('', 'combined', [], { status: { operator: 'in', values: ['active'] } }, []);
    expect(q['searchFields[status][in]']).toBe('active');
  });

  it('empty filters produce no bracket keys', () => {
    const q = buildFilterQuery('', 'combined', [], {}, []);
    expect(Object.keys(q)).toHaveLength(0);
  });

  it('filter with empty values is skipped', () => {
    const q = buildFilterQuery('', 'combined', [], { status: { operator: 'in', values: [] } }, []);
    expect(Object.keys(q).filter((k) => k.startsWith('searchFields'))).toHaveLength(0);
  });
});

describe('buildFilterQuery — orderBy serialization', () => {
  it('single sort field', () => {
    const q = buildFilterQuery('', 'combined', [], {}, [{ field: 'createdAt', direction: 'desc' }]);
    expect(q.orderBy).toEqual(['createdAt:desc']);
  });

  it('multiple sort fields preserve order', () => {
    const q = buildFilterQuery('', 'combined', [], {}, [
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
    expect(q.orderBy).toEqual(['createdAt:desc', 'name:asc']);
  });

  it('no sort fields omits orderBy key', () => {
    const q = buildFilterQuery('', 'combined', [], {}, []);
    expect(q).not.toHaveProperty('orderBy');
  });

  it('nested relation path in orderBy', () => {
    const q = buildFilterQuery('', 'combined', [], {}, [{ field: 'organizationUser.role', direction: 'asc' }]);
    expect(q.orderBy).toEqual(['organizationUser.role:asc']);
  });
});

describe('buildFilterQuery — relation field filters', () => {
  it('dot-notation field serializes to nested brackets', () => {
    const q = buildFilterQuery('', 'combined', [], {
      'sourceUser.email': { operator: 'contains', values: ['@test.com'] },
    }, []);
    expect(q['searchFields[sourceUser][email][contains]']).toBe('@test.com');
  });

  it('deep nesting: tokens.some.name', () => {
    const q = buildFilterQuery('', 'combined', [], {
      'tokens.some.name': { operator: 'contains', values: ['mytoken'] },
    }, []);
    expect(q['searchFields[tokens][some][name][contains]']).toBe('mytoken');
  });

  it('sibling relation fields do not collide', () => {
    const q = buildFilterQuery('', 'combined', [], {
      'sourceUser.name': { operator: 'contains', values: ['john'] },
      'sourceUser.email': { operator: 'contains', values: ['@test.com'] },
    }, []);
    expect(q['searchFields[sourceUser][name][contains]']).toBe('john');
    expect(q['searchFields[sourceUser][email][contains]']).toBe('@test.com');
  });
});

describe('buildFilterQuery — scalar operators', () => {
  it('equals uses first value', () => {
    const q = buildFilterQuery('', 'combined', [], {
      type: { operator: 'equals', values: ['transferSpace'] },
    }, []);
    expect(q['searchFields[type][equals]']).toBe('transferSpace');
  });

  it('contains uses first value', () => {
    const q = buildFilterQuery('', 'combined', [], {
      name: { operator: 'contains', values: ['acme'] },
    }, []);
    expect(q['searchFields[name][contains]']).toBe('acme');
  });

  it('startsWith uses first value', () => {
    const q = buildFilterQuery('', 'combined', [], {
      name: { operator: 'startsWith', values: ['A'] },
    }, []);
    expect(q['searchFields[name][startsWith]']).toBe('A');
  });

  it('endsWith uses first value', () => {
    const q = buildFilterQuery('', 'combined', [], {
      email: { operator: 'endsWith', values: ['.com'] },
    }, []);
    expect(q['searchFields[email][endsWith]']).toBe('.com');
  });
});

describe('buildFilterQuery — array operators', () => {
  it('in with multiple values produces array', () => {
    const q = buildFilterQuery('', 'combined', [], {
      status: { operator: 'in', values: ['sent', 'approved'] },
    }, []);
    expect(q['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('notIn with multiple values produces array', () => {
    const q = buildFilterQuery('', 'combined', [], {
      status: { operator: 'notIn', values: ['draft', 'canceled'] },
    }, []);
    expect(q['searchFields[status][notIn]']).toEqual(['draft', 'canceled']);
  });

  it('in with single value produces string (URLSearchParams behavior)', () => {
    const q = buildFilterQuery('', 'combined', [], {
      status: { operator: 'in', values: ['sent'] },
    }, []);
    expect(q['searchFields[status][in]']).toBe('sent');
  });
});

describe('buildFilterQuery — combined scenarios', () => {
  it('search + filter + orderBy all present', () => {
    const q = buildFilterQuery(
      'acme',
      'combined',
      ['name'],
      { status: { operator: 'in', values: ['active', 'pending'] } },
      [{ field: 'createdAt', direction: 'desc' }],
    );
    expect(q.search).toBe('acme');
    expect(q['searchFields[status][in]']).toEqual(['active', 'pending']);
    expect(q.orderBy).toEqual(['createdAt:desc']);
  });

  it('does not include page or pageSize (those are added by the controller)', () => {
    const q = buildFilterQuery('acme', 'combined', ['name'], {}, []);
    expect(q).not.toHaveProperty('page');
    expect(q).not.toHaveProperty('pageSize');
  });
});

// --- URL param round-trip ---

type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

function toParams(state: PersistedState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page != null && state.page > 1) params.set('page', String(state.page));
  if (state.pageSize != null) params.set('pageSize', String(state.pageSize));
  if (state.search) params.set('search', state.search);
  if (state.orderBy) for (const v of state.orderBy) params.append('orderBy', v);
  return params;
}

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

describe('URL param round-trip', () => {
  it('round-trips full state', () => {
    const original: PersistedState = {
      page: 5,
      pageSize: 50,
      search: 'hello world',
      orderBy: ['createdAt:desc', 'name:asc'],
    };
    expect(fromParams(toParams(original))).toEqual(original);
  });

  it('round-trips minimal state', () => {
    const original: PersistedState = { page: 2 };
    expect(fromParams(toParams(original))).toEqual(original);
  });

  it('round-trips search with special characters', () => {
    const original: PersistedState = { search: 'hello & world=yes' };
    expect(fromParams(toParams(original))).toEqual(original);
  });

  it('page 1 is not serialized (default omitted)', () => {
    const params = toParams({ page: 1, pageSize: 20 });
    expect(params.has('page')).toBe(false);
    expect(params.get('pageSize')).toBe('20');
  });

  it('empty state produces empty params', () => {
    const params = toParams({});
    expect(params.toString()).toBe('');
  });
});
