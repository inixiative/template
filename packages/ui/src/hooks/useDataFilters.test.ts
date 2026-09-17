import { describe, expect, it } from 'bun:test';
import { buildFilterQuery } from '@template/ui/lib/buildFilterQuery';

const buildQuery = (
  search: string,
  searchableFields: string[],
  filters: Parameters<typeof buildFilterQuery>[2],
  orderBy: Parameters<typeof buildFilterQuery>[3],
  page: number,
  pageSize: number,
): Record<string, unknown> => ({
  ...buildFilterQuery(search, searchableFields, filters, orderBy),
  page,
  pageSize,
});

// Shorthand helper
const q = (
  search = '',
  fields: string[] = [],
  filters: Parameters<typeof buildFilterQuery>[2] = {},
  orderBy: Parameters<typeof buildFilterQuery>[3] = [],
  page = 1,
  pageSize = 20,
) => buildQuery(search, fields, filters, orderBy, page, pageSize);

describe('buildQuery — base', () => {
  it('always includes page and pageSize', () => {
    expect(q()).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('respects custom page and pageSize', () => {
    expect(buildQuery('', [], {}, [], 3, 50)).toMatchObject({ page: 3, pageSize: 50 });
  });

  it('emits no extra keys when state is empty', () => {
    expect(Object.keys(q())).toEqual(['page', 'pageSize']);
  });
});

describe('buildQuery — search', () => {
  it('forwards the raw term as the top-level search param (BE fans it out)', () => {
    const result = q('foo', ['name', 'email']);
    expect(result.search).toBe('foo');
    expect(result['searchFields[name][contains]']).toBeUndefined();
  });

  it('no search key when the term is empty', () => {
    expect(q('', ['name']).search).toBeUndefined();
  });

  it('no searchableFields: search is suppressed (nothing to search against)', () => {
    expect(buildQuery('acme', [], {}, [], 1, 20).search).toBeUndefined();
  });

  it('with searchableFields: search is emitted', () => {
    expect(buildQuery('acme', ['name'], {}, [], 1, 20).search).toBe('acme');
  });
});

describe('buildQuery — enum filters', () => {
  it('in operator: emits array of values', () => {
    const result = q('', [], { status: { operator: 'in', value: ['sent', 'approved'] } });
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('notIn operator: emits array of values', () => {
    const result = q('', [], { status: { operator: 'notIn', value: ['draft', 'canceled'] } });
    expect(result['searchFields[status][notIn]']).toEqual(['draft', 'canceled']);
  });

  it('in with single value: emits string not array', () => {
    // URLSearchParams with one value → getAll returns [value] → length 1 → string
    const result = q('', [], { status: { operator: 'in', value: ['sent'] } });
    expect(result['searchFields[status][in]']).toBe('sent');
  });

  it('equals operator: emits single value', () => {
    const result = q('', [], { type: { operator: 'equals', value: 'transferSpace' } });
    expect(result['searchFields[type][equals]']).toBe('transferSpace');
  });

  it('contains operator: emits single value', () => {
    const result = q('', [], { name: { operator: 'contains', value: 'acme' } });
    expect(result['searchFields[name][contains]']).toBe('acme');
  });

  it('empty values: field not emitted', () => {
    const result = q('', [], { status: { operator: 'in', value: [] } });
    expect(Object.keys(result).every((k) => !k.startsWith('searchFields'))).toBe(true);
  });

  it('multiple filters coexist as separate keys', () => {
    const result = q('', [], {
      status: { operator: 'in', value: ['sent'] },
      type: { operator: 'notIn', value: ['cancelMembership'] },
    });
    expect(result['searchFields[status][in]']).toBe('sent');
    expect(result['searchFields[type][notIn]']).toBe('cancelMembership');
  });
});

describe('buildQuery — scalar comparison filters', () => {
  it('gte operator: emits single value', () => {
    const result = q('', [], { pointsAmount: { operator: 'gte', value: '100' } });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
  });

  it('lte operator: emits single value', () => {
    const result = q('', [], { pointsAmount: { operator: 'lte', value: '900' } });
    expect(result['searchFields[pointsAmount][lte]']).toBe('900');
  });

  it('gt / lt / not operators flow through as single values', () => {
    const result = q('', [], {
      a: { operator: 'gt', value: '1' },
      b: { operator: 'lt', value: '2' },
      c: { operator: 'not', value: '3' },
    });
    expect(result['searchFields[a][gt]']).toBe('1');
    expect(result['searchFields[b][lt]']).toBe('2');
    expect(result['searchFields[c][not]']).toBe('3');
  });

  it('two-sided range: merges gte and lte clauses for one field', () => {
    const result = q('', [], {
      pointsAmount: [
        { operator: 'gte', value: '100' },
        { operator: 'lte', value: '900' },
      ],
    });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
    expect(result['searchFields[pointsAmount][lte]']).toBe('900');
  });

  it('array in operator still works alongside the merge path', () => {
    const result = q('', [], { status: { operator: 'in', value: ['sent', 'approved'] } });
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('clause array with a single entry behaves like the single-clause form', () => {
    const result = q('', [], { pointsAmount: [{ operator: 'gte', value: '100' }] });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
  });
});

describe('buildQuery — relation field filters', () => {
  it('one level: sourceUser.email', () => {
    const result = q('', [], {
      'sourceUser.email': { operator: 'contains', value: '@hotmail.com' },
    });
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@hotmail.com');
  });

  it('two levels with relation op: tokens.some.name', () => {
    const result = q('', [], {
      'tokens.some.name': { operator: 'contains', value: 'mytoken' },
    });
    expect(result['searchFields[tokens][some][name][contains]']).toBe('mytoken');
  });

  it('relation with in operator', () => {
    const result = q('', [], {
      'sourceOrganization.id': { operator: 'in', value: ['org-1', 'org-2'] },
    });
    expect(result['searchFields[sourceOrganization][id][in]']).toEqual(['org-1', 'org-2']);
  });

  it('sibling relation fields share prefix without collision', () => {
    const result = q('', [], {
      'sourceUser.name': { operator: 'contains', value: 'john' },
      'sourceUser.email': { operator: 'contains', value: '@example.com' },
    });
    expect(result['searchFields[sourceUser][name][contains]']).toBe('john');
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@example.com');
  });
});

describe('buildQuery — orderBy', () => {
  it('single field asc', () => {
    expect(q('', [], {}, [{ field: 'createdAt', direction: 'asc' }]).orderBy).toEqual(['createdAt:asc']);
  });

  it('single field desc', () => {
    expect(q('', [], {}, [{ field: 'createdAt', direction: 'desc' }]).orderBy).toEqual(['createdAt:desc']);
  });

  it('multiple fields preserve order', () => {
    expect(
      q('', [], {}, [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]).orderBy,
    ).toEqual(['createdAt:desc', 'name:asc']);
  });

  it('nested relation path: organizationUser.role:asc', () => {
    expect(q('', [], {}, [{ field: 'organizationUser.role', direction: 'asc' }]).orderBy).toEqual([
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
      ['name'],
      { status: { operator: 'in', value: ['sent', 'approved'] } },
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
