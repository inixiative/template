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
