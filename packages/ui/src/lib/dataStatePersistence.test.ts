import { describe, expect, it } from 'bun:test';
import { parseOrderByStrings, readStateFromUrl } from '@template/ui/lib/dataStatePersistence';

describe('readStateFromUrl — page/pageSize hardening', () => {
  it('parses valid positive integers', () => {
    expect(readStateFromUrl('?page=3&pageSize=50')).toEqual({ page: 3, pageSize: 50 });
  });

  it('ignores non-numeric page/pageSize (NaN)', () => {
    expect(readStateFromUrl('?page=abc&pageSize=xyz')).toEqual({});
  });

  it('ignores zero and negative page/pageSize', () => {
    expect(readStateFromUrl('?page=0&pageSize=-5')).toEqual({});
  });

  it('carries search and orderBy through', () => {
    expect(readStateFromUrl('?search=hi&orderBy=name:asc')).toEqual({ search: 'hi', orderBy: ['name:asc'] });
  });
});

describe('parseOrderByStrings — direction fallback', () => {
  it('keeps explicit asc and desc', () => {
    expect(parseOrderByStrings(['name:desc', 'age:asc'])).toEqual([
      { field: 'name', direction: 'desc' },
      { field: 'age', direction: 'asc' },
    ]);
  });

  it('falls back to asc for a missing or arbitrary direction', () => {
    expect(parseOrderByStrings(['name', 'age:sideways'])).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'age', direction: 'asc' },
    ]);
  });
});
