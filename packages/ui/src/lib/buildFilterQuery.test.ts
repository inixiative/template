import { describe, expect, it } from 'bun:test';
import { buildFilterQuery, type FilterMap } from '@template/ui/lib/buildFilterQuery';

describe('buildFilterQuery', () => {
  it('serializes plain field filters into bracket keys', () => {
    const query = buildFilterQuery('', 'combined', [], { status: { operator: 'in', values: ['active'] } }, []);
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
      const query = buildFilterQuery('', 'combined', [], filters, []);
      expect(query).toEqual({
        'searchFields[AND][0][tokens][some][name][equals]': 'tok-a',
        'searchFields[AND][1][tokens][some][name][equals]': 'tok-b',
      });
    });

    it('emits OR the same way', () => {
      const filters: FilterMap = {
        OR: [{ status: { operator: 'equals', value: 'a' } }, { status: { operator: 'equals', value: 'b' } }],
      };
      const query = buildFilterQuery('', 'combined', [], filters, []);
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
      const query = buildFilterQuery('', 'combined', [], filters, []);
      expect(query).toEqual({
        'searchFields[AND][0][enrichments][some][value][in]': 'EMEA',
        'searchFields[AND][0][enrichments][some][fieldKey][equals]': 'businessUnit',
      });
    });

    it('drops empty groups and re-indexes the rest; drops the combinator when all groups are empty', () => {
      const withOneLive: FilterMap = {
        AND: [{ status: { operator: 'in', values: [] } }, { status: { operator: 'equals', value: 'a' } }],
      };
      expect(buildFilterQuery('', 'combined', [], withOneLive, [])).toEqual({
        'searchFields[AND][0][status][equals]': 'a',
      });

      const allEmpty: FilterMap = { AND: [{ status: { operator: 'in', values: [] } }] };
      expect(buildFilterQuery('', 'combined', [], allEmpty, [])).toEqual({});
    });

    it('combinators nest', () => {
      const filters: FilterMap = {
        AND: [{ OR: [{ status: { operator: 'equals', value: 'a' } }, { status: { operator: 'equals', value: 'b' } }] }],
      };
      const query = buildFilterQuery('', 'combined', [], filters, []);
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
      const query = buildFilterQuery('', 'combined', [], filters, []);
      expect(query).toEqual({
        'searchFields[status][equals]': 'active',
        'searchFields[AND][0][tokens][some][name][equals]': 'tok-a',
      });
    });
  });
});
