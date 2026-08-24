import { describe, expect, it } from 'bun:test';
import { serializeBracketQuery } from '@template/ui/lib/serializeBracketQuery';

describe('serializeBracketQuery', () => {
  it('serializes flat string value', () => {
    const params = serializeBracketQuery({ searchFields: { name: { contains: 'acme' } } });
    expect(params.get('searchFields[name][contains]')).toBe('acme');
  });

  it('serializes array values as repeated keys', () => {
    const params = serializeBracketQuery({ searchFields: { status: { in: ['sent', 'approved'] } } });
    expect(params.getAll('searchFields[status][in]')).toEqual(['sent', 'approved']);
  });

  it('serializes single-element array as single param', () => {
    const params = serializeBracketQuery({ searchFields: { status: { in: ['sent'] } } });
    expect(params.getAll('searchFields[status][in]')).toEqual(['sent']);
  });

  it('handles nested objects recursively', () => {
    const params = serializeBracketQuery({
      searchFields: { sourceUser: { email: { contains: '@test.com' } } },
    });
    expect(params.get('searchFields[sourceUser][email][contains]')).toBe('@test.com');
  });

  it('handles multiple fields at same level', () => {
    const params = serializeBracketQuery({
      searchFields: {
        name: { contains: 'acme' },
        status: { in: ['active'] },
      },
    });
    expect(params.get('searchFields[name][contains]')).toBe('acme');
    expect(params.getAll('searchFields[status][in]')).toEqual(['active']);
  });

  it('skips undefined values', () => {
    const params = serializeBracketQuery({ searchFields: { name: { contains: undefined } } });
    expect(params.toString()).toBe('');
  });

  it('handles empty object', () => {
    const params = serializeBracketQuery({});
    expect(params.toString()).toBe('');
  });

  it('serializes with filters prefix for admin mode', () => {
    const params = serializeBracketQuery({ filters: { status: { equals: 'active' } } });
    expect(params.get('filters[status][equals]')).toBe('active');
  });

  it('serializes notIn operator', () => {
    const params = serializeBracketQuery({ searchFields: { type: { notIn: ['draft', 'canceled'] } } });
    expect(params.getAll('searchFields[type][notIn]')).toEqual(['draft', 'canceled']);
  });

  it('marks nested numeric values with [$]', () => {
    const params = serializeBracketQuery({ filters: { age: { gte: 18 } } });
    expect(params.get('filters[age][gte][$]')).toBe('18');
    expect(params.get('filters[age][gte]')).toBeNull();
  });

  it('handles deeply nested relation paths', () => {
    const params = serializeBracketQuery({
      searchFields: { tokens: { some: { name: { contains: 'api' } } } },
    });
    expect(params.get('searchFields[tokens][some][name][contains]')).toBe('api');
  });
});

describe('serializeBracketQuery — symbol values ([:] marker)', () => {
  it('encodes null/boolean leaves via the [:] marker', () => {
    const params = serializeBracketQuery({ searchFields: { a: { equals: null }, b: { equals: true } } });
    expect(params.get('searchFields[a][equals][:]')).toBe('null');
    expect(params.get('searchFields[b][equals][:]')).toBe('true');
  });

  it('leaves string values un-marked', () => {
    const params = serializeBracketQuery({ searchFields: { a: { contains: 'x' } } });
    expect(params.get('searchFields[a][contains]')).toBe('x');
    expect(params.get('searchFields[a][contains][:]')).toBeNull();
  });

  it('marks null/boolean items inside arrays', () => {
    const params = serializeBracketQuery({ searchFields: { a: { in: ['x', null, true] } } });
    expect(params.getAll('searchFields[a][in]')).toEqual(['x']);
    expect(params.getAll('searchFields[a][in][:]')).toEqual(['null', 'true']);
  });
});

describe('serializeBracketQuery — number values ([$] marker)', () => {
  it('marks nested numbers, including inside arrays', () => {
    const params = serializeBracketQuery({ searchFields: { score: { in: [1, 2] }, age: { equals: 30 } } });
    expect(params.getAll('searchFields[score][in][$]')).toEqual(['1', '2']);
    expect(params.get('searchFields[age][equals][$]')).toBe('30');
  });

  it('keeps top-level numbers as plain params (page/pageSize stay hey-api compatible)', () => {
    const params = serializeBracketQuery({ page: 2, pageSize: 25, ids: [1, 2] });
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
    expect(params.getAll('ids')).toEqual(['1', '2']);
    expect(params.get('page[$]')).toBeNull();
  });

  it('keeps numeric strings un-marked', () => {
    const params = serializeBracketQuery({ searchFields: { zip: { equals: '90210' } } });
    expect(params.get('searchFields[zip][equals]')).toBe('90210');
    expect(params.get('searchFields[zip][equals][$]')).toBeNull();
  });

  it('serializes non-finite numbers as plain strings (no marker the parser would drop)', () => {
    const params = serializeBracketQuery({ searchFields: { a: { equals: Number.NaN } } });
    expect(params.get('searchFields[a][equals]')).toBe('NaN');
    expect(params.get('searchFields[a][equals][$]')).toBeNull();
  });
});
