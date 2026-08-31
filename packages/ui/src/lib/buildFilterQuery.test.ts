import { describe, expect, it } from 'bun:test';
import { buildFilterQuery, type FilterMap } from '@template/ui/lib/buildFilterQuery';

describe('buildFilterQuery', () => {
  it('serializes plain field filters into bracket keys', () => {
    const query = buildFilterQuery('', [], { status: { operator: 'in', values: ['active'] } }, []);
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
        OR: [{ status: { operator: 'equals', value: 'a' } }, { status: { operator: 'equals', value: 'b' } }],
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
            'enrichments.some.value': { operator: 'in', values: ['EMEA'] },
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
        AND: [{ status: { operator: 'in', values: [] } }, { status: { operator: 'equals', value: 'a' } }],
      };
      expect(buildFilterQuery('', [], withOneLive, [])).toEqual({
        'searchFields[AND][0][status][equals]': 'a',
      });

      const allEmpty: FilterMap = { AND: [{ status: { operator: 'in', values: [] } }] };
      expect(buildFilterQuery('', [], allEmpty, [])).toEqual({});
    });

    it('combinators nest', () => {
      const filters: FilterMap = {
        AND: [{ OR: [{ status: { operator: 'equals', value: 'a' } }, { status: { operator: 'equals', value: 'b' } }] }],
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
      const filters = { status: { operator: 'equals', value: 'active' }, AND: undefined } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({ 'searchFields[status][equals]': 'active' });
    });

    it('a scalar clause under a combinator key is dropped, not mapped over', () => {
      const filters = { AND: { operator: 'equals', value: 'x' } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a null value is skipped', () => {
      const filters = { status: null, AND: null } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a bare-string `values` is dropped, not serialized character by character', () => {
      // The trap: a string has `.length`, so it clears the empty check, and the operator then
      // gets the raw string — a wrong query that looks like a working one. `values` must be an array.
      const filters = { name: { operator: 'in', values: 'abc' } } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({});
    });

    it('a non-map group under a combinator key is dropped, not recursed into', () => {
      const filters = { AND: ['nope', null, { status: { operator: 'equals', value: 'a' } }] } as unknown as FilterMap;
      expect(buildFilterQuery('', [], filters, [])).toEqual({
        'searchFields[AND][0][status][equals]': 'a',
      });
    });

    it('a group-array under a plain field key is dropped, not treated as clauses', () => {
      const filters = { tokens: [{ name: { operator: 'contains', value: 'x' } }] } as unknown as FilterMap;
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
      const filters: FilterMap = { tier: { operator: 'in', values: ['gold', null] } };
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
