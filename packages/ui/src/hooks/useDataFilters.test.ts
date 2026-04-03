import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/hooks/useDataFilters';

/** Wrapper that adds page/pageSize to buildFilterQuery for test compatibility. */
const buildQuery = (
  search: string,
  searchMode: 'combined' | 'field',
  searchableFields: string[],
  filters: Parameters<typeof buildFilterQuery>[3],
  orderBy: Parameters<typeof buildFilterQuery>[4],
  page: number,
  pageSize: number,
  adminMode = false,
): Record<string, unknown> => ({
  ...buildFilterQuery(search, searchMode, searchableFields, filters, orderBy, adminMode),
  page,
  pageSize,
});

// Shorthand helpers
const q = (
  search = '',
  mode: 'combined' | 'field' = 'combined',
  fields: string[] = [],
  filters: Parameters<typeof buildFilterQuery>[3] = {},
  orderBy: Parameters<typeof buildFilterQuery>[4] = [],
  page = 1,
  pageSize = 20,
) => buildQuery(search, mode, fields, filters, orderBy, page, pageSize);

describe('buildQuery — base', () => {
  it('always includes page and pageSize', () => {
    expect(q()).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('respects custom page and pageSize', () => {
    expect(buildQuery('', 'combined', [], {}, [], 3, 50)).toMatchObject({ page: 3, pageSize: 50 });
  });

  it('emits no extra keys when state is empty', () => {
    expect(Object.keys(q())).toEqual(['page', 'pageSize']);
  });
});

describe('buildQuery — search', () => {
  it('combined mode: top-level search param', () => {
    const result = q('foo', 'combined', ['name', 'email']);
    expect(result.search).toBe('foo');
    expect(result['searchFields[name][contains]']).toBeUndefined();
  });

  it('combined mode: no search key when search is empty', () => {
    expect(q('', 'combined', ['name']).search).toBeUndefined();
  });

  it('field mode: bracket key per searchable field', () => {
    const result = q('foo', 'field', ['name', 'email']);
    expect(result['searchFields[name][contains]']).toBe('foo');
    expect(result['searchFields[email][contains]']).toBe('foo');
    expect(result).not.toHaveProperty('search');
  });

  it('field mode: no searchFields keys when search is empty', () => {
    const result = q('', 'field', ['name', 'email']);
    expect(Object.keys(result).every((k) => !k.startsWith('searchFields'))).toBe(true);
  });
});

describe('buildQuery — enum filters', () => {
  it('in operator: emits array of values', () => {
    const result = q('', 'combined', [], { status: { operator: 'in', values: ['sent', 'approved'] } });
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('notIn operator: emits array of values', () => {
    const result = q('', 'combined', [], { status: { operator: 'notIn', values: ['draft', 'canceled'] } });
    expect(result['searchFields[status][notIn]']).toEqual(['draft', 'canceled']);
  });

  it('in with single value: emits string not array', () => {
    // URLSearchParams with one value → getAll returns [value] → length 1 → string
    const result = q('', 'combined', [], { status: { operator: 'in', values: ['sent'] } });
    expect(result['searchFields[status][in]']).toBe('sent');
  });

  it('equals operator: emits single value', () => {
    const result = q('', 'combined', [], { type: { operator: 'equals', values: ['transferSpace'] } });
    expect(result['searchFields[type][equals]']).toBe('transferSpace');
  });

  it('contains operator: emits single value', () => {
    const result = q('', 'combined', [], { name: { operator: 'contains', values: ['acme'] } });
    expect(result['searchFields[name][contains]']).toBe('acme');
  });

  it('empty values: field not emitted', () => {
    const result = q('', 'combined', [], { status: { operator: 'in', values: [] } });
    expect(Object.keys(result).every((k) => !k.startsWith('searchFields'))).toBe(true);
  });

  it('multiple filters coexist as separate keys', () => {
    const result = q('', 'combined', [], {
      status: { operator: 'in', values: ['sent'] },
      type: { operator: 'notIn', values: ['cancelMembership'] },
    });
    expect(result['searchFields[status][in]']).toBe('sent');
    expect(result['searchFields[type][notIn]']).toBe('cancelMembership');
  });
});

describe('buildQuery — relation field filters', () => {
  it('one level: sourceUser.email', () => {
    const result = q('', 'combined', [], {
      'sourceUser.email': { operator: 'contains', values: ['@hotmail.com'] },
    });
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@hotmail.com');
  });

  it('two levels with relation op: tokens.some.name', () => {
    const result = q('', 'combined', [], {
      'tokens.some.name': { operator: 'contains', values: ['mytoken'] },
    });
    expect(result['searchFields[tokens][some][name][contains]']).toBe('mytoken');
  });

  it('relation with in operator', () => {
    const result = q('', 'combined', [], {
      'sourceOrganization.id': { operator: 'in', values: ['org-1', 'org-2'] },
    });
    expect(result['searchFields[sourceOrganization][id][in]']).toEqual(['org-1', 'org-2']);
  });

  it('sibling relation fields share prefix without collision', () => {
    const result = q('', 'combined', [], {
      'sourceUser.name': { operator: 'contains', values: ['john'] },
      'sourceUser.email': { operator: 'contains', values: ['@example.com'] },
    });
    expect(result['searchFields[sourceUser][name][contains]']).toBe('john');
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@example.com');
  });
});

describe('buildQuery — orderBy', () => {
  it('single field asc', () => {
    expect(q('', 'combined', [], {}, [{ field: 'createdAt', direction: 'asc' }]).orderBy).toEqual(['createdAt:asc']);
  });

  it('single field desc', () => {
    expect(q('', 'combined', [], {}, [{ field: 'createdAt', direction: 'desc' }]).orderBy).toEqual(['createdAt:desc']);
  });

  it('multiple fields preserve order', () => {
    expect(
      q('', 'combined', [], {}, [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]).orderBy,
    ).toEqual(['createdAt:desc', 'name:asc']);
  });

  it('nested relation path: organizationUser.role:asc', () => {
    expect(q('', 'combined', [], {}, [{ field: 'organizationUser.role', direction: 'asc' }]).orderBy).toEqual([
      'organizationUser.role:asc',
    ]);
  });

  it('no orderBy key when orderBy is empty', () => {
    expect(q()).not.toHaveProperty('orderBy');
  });
});

describe('buildQuery — combined', () => {
  it('search + filter + orderBy all present', () => {
    const result = buildQuery(
      'acme',
      'combined',
      ['name'],
      { status: { operator: 'in', values: ['sent', 'approved'] } },
      [{ field: 'createdAt', direction: 'desc' }],
      2,
      25,
    );
    expect(result.search).toBe('acme');
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
    expect(result.orderBy).toEqual(['createdAt:desc']);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(25);
  });
});

describe('buildQuery — adminMode', () => {
  it('non-admin (default): uses searchFields prefix', () => {
    const result = q('', 'combined', [], { status: { operator: 'in', values: ['sent'] } });
    expect(result['searchFields[status][in]']).toBeDefined();
    expect(result['filters[status][in]']).toBeUndefined();
  });

  it('adminMode: uses filters prefix (direct Prisma, no validation)', () => {
    const result = buildQuery('', 'combined', [], { status: { operator: 'in', values: ['sent'] } }, [], 1, 20, true);
    expect(result['filters[status][in]']).toBe('sent');
    expect(result['searchFields[status][in]']).toBeUndefined();
  });

  it('adminMode: relation paths still serialize correctly under filters', () => {
    const result = buildQuery(
      '',
      'combined',
      [],
      { 'organizationUser.role': { operator: 'equals', values: ['admin'] } },
      [],
      1,
      20,
      true,
    );
    expect(result['filters[organizationUser][role][equals]']).toBe('admin');
  });

  it('adminMode: combined search is suppressed (no broad search facility in filters mode)', () => {
    const result = buildQuery('acme', 'combined', ['name', 'email'], {}, [], 1, 20, true);
    expect(result.search).toBeUndefined();
  });

  it('non-admin with no searchableFields: search is suppressed (nothing to search against)', () => {
    const result = buildQuery('acme', 'combined', [], {}, [], 1, 20, false);
    expect(result.search).toBeUndefined();
  });

  it('non-admin with searchableFields: combined search emitted', () => {
    const result = buildQuery('acme', 'combined', ['name'], {}, [], 1, 20, false);
    expect(result.search).toBe('acme');
  });
});
