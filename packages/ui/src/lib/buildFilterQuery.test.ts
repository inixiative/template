import { describe, expect, it } from 'bun:test';
import { buildFilterQuery, type FilterMap } from '@template/ui/lib/buildFilterQuery';

describe('buildFilterQuery', () => {
  it('serializes plain field filters into bracket keys', () => {
    const query = buildFilterQuery('', [], { status: { operator: 'in', value: ['active'] } }, []);
    expect(query).toEqual({ 'searchFields[status][in]': 'active' });
  });

  describe('combinator keys', () => {
    it('emits one indexed child per group under AND', () => {
      const filters: FilterMap = {
        AND: [
          { 'tokens.some.name': { operator: 'equals', value: 'tok-a' } },
          { 'tokens.some.name': { operator: 'equals', value: 'tok-b' } },
        ],
      };
      const query = buildFilterQuery('', [], filters, []);
      expect(query).toEqual({
        'searchFields[AND][0][tokens][some][name][equals]': 'tok-a',
        'searchFields[AND][1][tokens][some][name][equals]': 'tok-b',
      });
    });

    it('emits OR the same way', () => {
      const filters: FilterMap = {
        OR: [
          { status: { operator: 'equals', value: 'a' } },
          { status: { operator: 'equals', value: 'b' } },
        ],
      };
      const query = buildFilterQuery('', [], filters, []);
      expect(query).toEqual({
        'searchFields[OR][0][status][equals]': 'a',
        'searchFields[OR][1][status][equals]': 'b',
      });
    });

    it('a group may carry several clauses, merged like top-level filters', () => {
      const filters: FilterMap = {
        AND: [
          {
            'enrichments.some.value': { operator: 'in', value: ['EMEA'] },
            'enrichments.some.fieldKey': { operator: 'equals', value: 'businessUnit' },
          },
        ],
      };
      const query = buildFilterQuery('', [], filters, []);
      expect(query).toEqual({
        'searchFields[AND][0][enrichments][some][value][in]': 'EMEA',
        'searchFields[AND][0][enrichments][some][fieldKey][equals]': 'businessUnit',
      });
    });

    it('drops empty groups and re-indexes the rest; drops the combinator when all groups are empty', () => {
      const withOneLive: FilterMap = {
        AND: [
          { status: { operator: 'in', value: [] } },
          { status: { operator: 'equals', value: 'a' } },
        ],
      };
      expect(buildFilterQuery('', [], withOneLive, [])).toEqual({
        'searchFields[AND][0][status][equals]': 'a',
      });

      const allEmpty: FilterMap = { AND: [{ status: { operator: 'in', value: [] } }] };
      expect(buildFilterQuery('', [], allEmpty, [])).toEqual({});
    });

    it('combinators nest', () => {
      const filters: FilterMap = {
        AND: [
          {
            OR: [
              { status: { operator: 'equals', value: 'a' } },
              { status: { operator: 'equals', value: 'b' } },
            ],
          },
        ],
      };
      const query = buildFilterQuery('', [], filters, []);
      expect(query).toEqual({
        'searchFields[AND][0][OR][0][status][equals]': 'a',
        'searchFields[AND][0][OR][1][status][equals]': 'b',
      });
    });

    it('combinator groups coexist with plain filters', () => {
      const filters: FilterMap = {
        status: { operator: 'equals', value: 'active' },
        AND: [{ 'tokens.some.name': { operator: 'equals', value: 'tok-a' } }],
      };
      const query = buildFilterQuery('', [], filters, []);
      expect(query).toEqual({
        'searchFields[status][equals]': 'active',
        'searchFields[AND][0][tokens][some][name][equals]': 'tok-a',
      });
    });
  });

  // The FilterMap index signature can't be narrowed to reject a non-array under a combinator key
  // (an open string index and typed AND/OR keys are mutually exclusive in TS), so addFilters is
  // the gate. A shared render primitive must never throw on a malformed map — it drops the bad
  // slot, the same outcome the server reaches by 400ing the equivalent wire.
  describe('malformed input never throws', () => {
    it('an absent combinator (undefined) is skipped, not dereferenced', () => {
      // The reference-board default load: `filters.AND = enrichments?.map(...)` is undefined when
      // no form-field filter is active, and the key is assigned rather than omitted.
      const filters = {
        status: { operator: 'equals', value: 'active' },
        AND: undefined,
      } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[status][equals]': 'active',
      });
    });

    it('a scalar clause under a combinator key is dropped, not mapped over', () => {
      const filters = { AND: { operator: 'equals', value: 'x' } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a null value is skipped', () => {
      const filters = { status: null, AND: null } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a scalar value under an array operator is dropped (in/notIn require an array)', () => {
      // The value shape must match the operator, like the engine's Rule: `in` takes an array. A
      // bare scalar would otherwise serialize as `in: 'abc'`, a wrong query the server 400s.
      const filters = { name: { operator: 'in', value: 'abc' } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('an array value under a scalar operator is dropped (equals takes a scalar)', () => {
      const filters = { name: { operator: 'equals', value: ['a', 'b'] } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a non-map group under a combinator key is dropped, not recursed into', () => {
      const filters = {
        AND: ['nope', null, { status: { operator: 'equals', value: 'a' } }],
      } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[AND][0][status][equals]': 'a',
      });
    });

    it('a group-array under a plain field key is dropped, not treated as clauses', () => {
      const filters = {
        tokens: [{ name: { operator: 'contains', value: 'x' } }],
      } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });
  });

  // The wire and the server already carry typed values: `[:]` marks a symbol (null/boolean),
  // `[$]` marks a number, both parsed back to the real type server-side. FilterState carries the
  // real type so those markers get used — a string-only leaf would force every value to text.
  // `null` is a value (match IS NULL); `undefined` is the absence of a filter.
  describe('typed scalar values', () => {
    it('serializes null via the symbol marker (match IS NULL)', () => {
      const filters: FilterMap = { tier: { operator: 'equals', value: null } };
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[tier][equals][:]': 'null',
      });
    });

    it('serializes false via the symbol marker, not dropped as falsy', () => {
      const filters: FilterMap = { isActive: { operator: 'equals', value: false } };
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[isActive][equals][:]': 'false',
      });
    });

    it('serializes numbers via the number marker, including zero', () => {
      expect(buildFilterQuery('', [], { age: { operator: 'gte', value: 30 } }, [])).toEqual({
        'searchFields[age][gte][$]': '30',
      });
      expect(buildFilterQuery('', [], { rank: { operator: 'equals', value: 0 } }, [])).toEqual({
        'searchFields[rank][equals][$]': '0',
      });
    });

    it('carries typed values inside an `in` list', () => {
      const filters: FilterMap = { tier: { operator: 'in', value: ['gold', null] } };
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[tier][in]': 'gold',
        'searchFields[tier][in][:]': 'null',
      });
    });

    it('undefined is the absence of a filter — the key is dropped', () => {
      const filters = { tier: { operator: 'equals', value: undefined } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });
  });
});

const buildFilterQueryWithPaging = (
  search = '',
  searchableFields: string[] = [],
  filters: Parameters<typeof buildFilterQuery>[2] = {},
  orderBy: Parameters<typeof buildFilterQuery>[3] = [],
  page = 1,
  pageSize = 20,
): Record<string, unknown> => ({
  ...buildFilterQuery(search, searchableFields, filters, orderBy),
  page,
  pageSize,
});

describe('buildFilterQuery with paging — base', () => {
  it('always includes page and pageSize', () => {
    expect(buildFilterQueryWithPaging()).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('respects custom page and pageSize', () => {
    expect(buildFilterQueryWithPaging('', [], {}, [], 3, 50)).toMatchObject({
      page: 3,
      pageSize: 50,
    });
  });

  it('emits no extra keys when state is empty', () => {
    expect(Object.keys(buildFilterQueryWithPaging())).toEqual(['page', 'pageSize']);
  });
});

describe('buildFilterQuery with paging — search', () => {
  it('forwards the raw term as the top-level search param (BE fans it out)', () => {
    const result = buildFilterQueryWithPaging('foo', ['name', 'email']);
    expect(result.search).toBe('foo');
    expect(result['searchFields[name][contains]']).toBeUndefined();
  });

  it('no search key when the term is empty', () => {
    expect(buildFilterQueryWithPaging('', ['name']).search).toBeUndefined();
  });

  it('no searchableFields: search is suppressed (nothing to search against)', () => {
    expect(buildFilterQueryWithPaging('acme', [], {}, [], 1, 20).search).toBeUndefined();
  });

  it('with searchableFields: search is emitted', () => {
    expect(buildFilterQueryWithPaging('acme', ['name'], {}, [], 1, 20).search).toBe('acme');
  });
});

describe('buildFilterQuery with paging — enum filters', () => {
  it('in operator: emits array of values', () => {
    const result = buildFilterQueryWithPaging('', [], {
      status: { operator: 'in', value: ['sent', 'approved'] },
    });
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('notIn operator: emits array of values', () => {
    const result = buildFilterQueryWithPaging('', [], {
      status: { operator: 'notIn', value: ['draft', 'canceled'] },
    });
    expect(result['searchFields[status][notIn]']).toEqual(['draft', 'canceled']);
  });

  it('in with single value: emits string not array', () => {
    // URLSearchParams with one value → getAll returns [value] → length 1 → string
    const result = buildFilterQueryWithPaging('', [], {
      status: { operator: 'in', value: ['sent'] },
    });
    expect(result['searchFields[status][in]']).toBe('sent');
  });

  it('equals operator: emits single value', () => {
    const result = buildFilterQueryWithPaging('', [], {
      type: { operator: 'equals', value: 'transferSpace' },
    });
    expect(result['searchFields[type][equals]']).toBe('transferSpace');
  });

  it('contains operator: emits single value', () => {
    const result = buildFilterQueryWithPaging('', [], {
      name: { operator: 'contains', value: 'acme' },
    });
    expect(result['searchFields[name][contains]']).toBe('acme');
  });

  it('empty values: field not emitted', () => {
    const result = buildFilterQueryWithPaging('', [], { status: { operator: 'in', value: [] } });
    expect(Object.keys(result).every((k) => !k.startsWith('searchFields'))).toBe(true);
  });

  it('multiple filters coexist as separate keys', () => {
    const result = buildFilterQueryWithPaging('', [], {
      status: { operator: 'in', value: ['sent'] },
      type: { operator: 'notIn', value: ['cancelMembership'] },
    });
    expect(result['searchFields[status][in]']).toBe('sent');
    expect(result['searchFields[type][notIn]']).toBe('cancelMembership');
  });
});

describe('buildFilterQuery with paging — scalar comparison filters', () => {
  it('gte operator: emits single value', () => {
    const result = buildFilterQueryWithPaging('', [], {
      pointsAmount: { operator: 'gte', value: '100' },
    });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
  });

  it('lte operator: emits single value', () => {
    const result = buildFilterQueryWithPaging('', [], {
      pointsAmount: { operator: 'lte', value: '900' },
    });
    expect(result['searchFields[pointsAmount][lte]']).toBe('900');
  });

  it('gt / lt / not operators flow through as single values', () => {
    const result = buildFilterQueryWithPaging('', [], {
      a: { operator: 'gt', value: '1' },
      b: { operator: 'lt', value: '2' },
      c: { operator: 'not', value: '3' },
    });
    expect(result['searchFields[a][gt]']).toBe('1');
    expect(result['searchFields[b][lt]']).toBe('2');
    expect(result['searchFields[c][not]']).toBe('3');
  });

  it('two-sided range: merges gte and lte clauses for one field', () => {
    const result = buildFilterQueryWithPaging('', [], {
      pointsAmount: [
        { operator: 'gte', value: '100' },
        { operator: 'lte', value: '900' },
      ],
    });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
    expect(result['searchFields[pointsAmount][lte]']).toBe('900');
  });

  it('array in operator still works alongside the merge path', () => {
    const result = buildFilterQueryWithPaging('', [], {
      status: { operator: 'in', value: ['sent', 'approved'] },
    });
    expect(result['searchFields[status][in]']).toEqual(['sent', 'approved']);
  });

  it('clause array with a single entry behaves like the single-clause form', () => {
    const result = buildFilterQueryWithPaging('', [], {
      pointsAmount: [{ operator: 'gte', value: '100' }],
    });
    expect(result['searchFields[pointsAmount][gte]']).toBe('100');
  });
});

describe('buildFilterQuery with paging — relation field filters', () => {
  it('one level: sourceUser.email', () => {
    const result = buildFilterQueryWithPaging('', [], {
      'sourceUser.email': { operator: 'contains', value: '@hotmail.com' },
    });
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@hotmail.com');
  });

  it('two levels with relation op: tokens.some.name', () => {
    const result = buildFilterQueryWithPaging('', [], {
      'tokens.some.name': { operator: 'contains', value: 'mytoken' },
    });
    expect(result['searchFields[tokens][some][name][contains]']).toBe('mytoken');
  });

  it('relation with in operator', () => {
    const result = buildFilterQueryWithPaging('', [], {
      'sourceOrganization.id': { operator: 'in', value: ['org-1', 'org-2'] },
    });
    expect(result['searchFields[sourceOrganization][id][in]']).toEqual(['org-1', 'org-2']);
  });

  it('sibling relation fields share prefix without collision', () => {
    const result = buildFilterQueryWithPaging('', [], {
      'sourceUser.name': { operator: 'contains', value: 'john' },
      'sourceUser.email': { operator: 'contains', value: '@example.com' },
    });
    expect(result['searchFields[sourceUser][name][contains]']).toBe('john');
    expect(result['searchFields[sourceUser][email][contains]']).toBe('@example.com');
  });
});

describe('buildFilterQuery with paging — orderBy', () => {
  it('single field asc', () => {
    expect(
      buildFilterQueryWithPaging('', [], {}, [{ field: 'createdAt', direction: 'asc' }]).orderBy,
    ).toEqual(['createdAt:asc']);
  });

  it('single field desc', () => {
    expect(
      buildFilterQueryWithPaging('', [], {}, [{ field: 'createdAt', direction: 'desc' }]).orderBy,
    ).toEqual(['createdAt:desc']);
  });

  it('multiple fields preserve order', () => {
    expect(
      buildFilterQueryWithPaging('', [], {}, [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ]).orderBy,
    ).toEqual(['createdAt:desc', 'name:asc']);
  });

  it('nested relation path: organizationUser.role:asc', () => {
    expect(
      buildFilterQueryWithPaging('', [], {}, [{ field: 'organizationUser.role', direction: 'asc' }])
        .orderBy,
    ).toEqual(['organizationUser.role:asc']);
  });

  it('no orderBy key when orderBy is empty', () => {
    expect(buildFilterQueryWithPaging()).not.toHaveProperty('orderBy');
  });
});

describe('buildFilterQuery with paging — combined', () => {
  it('search + filter + orderBy all present', () => {
    const result = buildFilterQueryWithPaging(
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
