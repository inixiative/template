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

  it('handles numeric values', () => {
    const params = serializeBracketQuery({ filters: { age: { gte: 18 } } });
    expect(params.get('filters[age][gte]')).toBe('18');
  });

  it('handles deeply nested relation paths', () => {
    const params = serializeBracketQuery({
      searchFields: { tokens: { some: { name: { contains: 'api' } } } },
    });
    expect(params.get('searchFields[tokens][some][name][contains]')).toBe('api');
  });
});
