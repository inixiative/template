import { describe, expect, it } from 'bun:test';
import { parseBracketNotation } from '#/lib/utils/parseBracketNotation';

describe('parseBracketNotation', () => {
  it('parses single-level bracket notation', () => {
    const url = '?filters[status]=active&filters[type]=admin';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        status: 'active',
        type: 'admin',
      },
    });
  });

  it('parses multi-level bracket notation', () => {
    const url = '?searchFields[user][name][contains]=dragon';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      searchFields: {
        user: {
          name: {
            contains: 'dragon',
          },
        },
      },
    });
  });

  it('merges multiple params at same path', () => {
    const url = '?searchFields[user][name][contains]=dragon&searchFields[user][createdAt][gte]=2024-01-01';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      searchFields: {
        user: {
          name: {
            contains: 'dragon',
          },
          createdAt: {
            gte: '2024-01-01',
          },
        },
      },
    });
  });

  it('collects repeated leaf params into arrays', () => {
    const url =
      '?searchFields[type][in]=inviteOrganizationUser&searchFields[type][in]=transferSpace&searchFields[status][notIn]=denied&searchFields[status][notIn]=canceled';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      searchFields: {
        type: {
          in: ['inviteOrganizationUser', 'transferSpace'],
        },
        status: {
          notIn: ['denied', 'canceled'],
        },
      },
    });
  });

  it('handles URL encoding', () => {
    const url = '?filters[name]=John%20Doe';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        name: 'John Doe',
      },
    });
  });

  it('handles plus signs as spaces', () => {
    const url = '?filters[name]=John+Doe';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        name: 'John Doe',
      },
    });
  });

  it('does not double-decode: literal % survives and encoded + stays a plus', () => {
    expect(parseBracketNotation('?filters[promo]=50%25off')).toEqual({ filters: { promo: '50%off' } });
    expect(parseBracketNotation('?filters[email]=a%2Bb%40x.com')).toEqual({ filters: { email: 'a+b@x.com' } });
  });

  it('ignores non-bracket params', () => {
    const url = '?page=1&filters[status]=active&limit=10';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        status: 'active',
      },
    });
  });

  it('handles deep nesting', () => {
    const url = '?data[level1][level2][level3][level4]=value';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      data: {
        level1: {
          level2: {
            level3: {
              level4: 'value',
            },
          },
        },
      },
    });
  });

  it('handles empty values', () => {
    const url = '?filters[status]=';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        status: '',
      },
    });
  });

  it('trims whitespace from values', () => {
    const url = '?filters[name]=%20%20John%20Doe%20%20';
    const result = parseBracketNotation(url);

    expect(result).toEqual({
      filters: {
        name: 'John Doe',
      },
    });
  });
});

describe('parseBracketNotation — symbol values ([:] marker)', () => {
  it('casts [:]-marked null/true/false to symbols', () => {
    expect(parseBracketNotation('?searchFields[a][equals][:]=null').searchFields).toEqual({ a: { equals: null } });
    expect(parseBracketNotation('?searchFields[a][equals][:]=true').searchFields).toEqual({ a: { equals: true } });
    expect(parseBracketNotation('?searchFields[a][equals][:]=false').searchFields).toEqual({ a: { equals: false } });
  });

  it('keeps plain (un-marked) values as strings', () => {
    expect(parseBracketNotation('?searchFields[a][equals]=null').searchFields).toEqual({ a: { equals: 'null' } });
    expect(parseBracketNotation('?searchFields[a][equals]=true').searchFields).toEqual({ a: { equals: 'true' } });
  });

  it('skips a [:] marker whose value is not a valid symbol (no eval, no raw-string fallback)', () => {
    // `[:]` marks a symbol (null/true/false); a non-symbol value is malformed and
    // the leaf is dropped rather than silently stored as a raw string. The
    // intermediate parent object is still created before the skip.
    expect(parseBracketNotation('?searchFields[a][equals][:]=bogus').searchFields).toEqual({ a: {} });
    expect(parseBracketNotation('?searchFields[name][:]=dragon').searchFields).toEqual({});
    expect(parseBracketNotation('?searchFields[name][:]=dragon&searchFields[email]=a@b.com').searchFields).toEqual({
      email: 'a@b.com',
    });
  });

  it('supports a bare [:] symbol value', () => {
    expect(parseBracketNotation('?searchFields[a][:]=null').searchFields).toEqual({ a: null });
  });

  it('casts lenient boolean spellings (0/1/t/f)', () => {
    expect(parseBracketNotation('?searchFields[a][equals][:]=1').searchFields).toEqual({ a: { equals: true } });
    expect(parseBracketNotation('?searchFields[a][equals][:]=0').searchFields).toEqual({ a: { equals: false } });
    expect(parseBracketNotation('?searchFields[a][equals][:]=t').searchFields).toEqual({ a: { equals: true } });
    expect(parseBracketNotation('?searchFields[a][equals][:]=f').searchFields).toEqual({ a: { equals: false } });
  });
});

describe('parseBracketNotation — number values ([$] marker)', () => {
  it('casts [$]-marked tokens to numbers', () => {
    expect(parseBracketNotation('?searchFields[age][gte][$]=18').searchFields).toEqual({ age: { gte: 18 } });
    expect(parseBracketNotation('?searchFields[score][equals][$]=-2.5').searchFields).toEqual({
      score: { equals: -2.5 },
    });
  });

  it('keeps plain (un-marked) numeric values as strings', () => {
    expect(parseBracketNotation('?searchFields[age][gte]=18').searchFields).toEqual({ age: { gte: '18' } });
  });

  it('collects repeated [$]-marked params into a number array', () => {
    expect(parseBracketNotation('?searchFields[score][in][$]=1&searchFields[score][in][$]=2').searchFields).toEqual({
      score: { in: [1, 2] },
    });
  });

  it('accumulates mixed-typed items at the same leaf', () => {
    const url = '?searchFields[a][in][$]=1&searchFields[a][in]=x&searchFields[a][in][:]=null';
    expect(parseBracketNotation(url).searchFields).toEqual({ a: { in: [1, 'x', null] } });
  });

  it('skips a [$] marker whose value is not a finite number', () => {
    expect(parseBracketNotation('?searchFields[a][equals][$]=abc').searchFields).toEqual({ a: {} });
    expect(parseBracketNotation('?searchFields[a][equals][$]=Infinity').searchFields).toEqual({ a: {} });
    expect(parseBracketNotation('?searchFields[a][equals][$]=').searchFields).toEqual({ a: {} });
  });

  it('supports a bare [$] number value', () => {
    expect(parseBracketNotation('?searchFields[a][$]=7').searchFields).toEqual({ a: 7 });
  });
});
