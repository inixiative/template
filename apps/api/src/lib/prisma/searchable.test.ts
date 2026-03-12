import { describe, expect, it } from 'bun:test';
import { searchable } from '#/lib/prisma/searchable';

describe('searchable', () => {
  it('expands scalar fields on root model', () => {
    expect(searchable({ organization: ['name', 'slug'] })).toEqual(['name', 'slug']);
  });

  it('accepts camelCase model name', () => {
    expect(searchable({ organization: ['name'] })).toEqual(['name']);
  });

  it('accepts PascalCase model name', () => {
    expect(searchable({ Organization: ['name'] })).toEqual(['name']);
  });

  it('expands relation with nested fields', () => {
    const result = searchable({
      organization: [{ organizationUsers: ['role'] }],
    });

    expect(result).toEqual(['organizationUsers.role']);
  });

  it('mixes scalars and relations', () => {
    const result = searchable({
      organization: ['name', 'slug', { organizationUsers: ['role'] }],
    });

    expect(result).toEqual(['name', 'slug', 'organizationUsers.role']);
  });

  it('supports deeply nested relations', () => {
    const result = searchable({
      organization: [{ organizationUsers: ['role', { user: ['name'] }] }],
    });

    expect(result).toEqual(['organizationUsers.role', 'organizationUsers.user.name']);
  });

  it('supports single string value for relation', () => {
    const result = searchable({ organization: [{ organizationUsers: 'role' }] });

    expect(result).toEqual(['organizationUsers.role']);
  });

  it('supports object shorthand for single nested relation', () => {
    const result = searchable({
      organization: [{ organizationUsers: { user: ['name', 'email'] } }],
    });

    expect(result).toEqual(['organizationUsers.user.name', 'organizationUsers.user.email']);
  });

  it('returns empty array for empty fields', () => {
    expect(searchable({ organization: [] })).toEqual([]);
  });

  it('throws for invalid model name', () => {
    expect(() => searchable({ notAModel: ['name'] })).toThrow("not a valid Prisma model");
  });

  it('throws for invalid field on model', () => {
    expect(() => searchable({ organization: ['nonexistent'] })).toThrow("does not exist on model");
  });

  it('throws when using a relation as a scalar', () => {
    expect(() => searchable({ organization: ['organizationUsers'] })).toThrow("is a relation");
  });

  it('throws when using a scalar as a relation', () => {
    expect(() => searchable({ organization: [{ name: ['something'] }] })).toThrow("is not a relation");
  });

  it('throws for multiple root keys', () => {
    expect(() => searchable({ organization: ['name'], user: ['email'] })).toThrow("exactly one model");
  });
});
