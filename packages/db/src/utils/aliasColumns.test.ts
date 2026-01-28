import { describe, expect, it } from 'bun:test';
import { aliasColumns } from '@template/db/utils/aliasColumns';

describe('aliasColumns', () => {
  it('generates aliases with model name prefix', () => {
    const result = aliasColumns('User');
    expect(result).toContain('User."id" AS "User.id"');
    expect(result).toContain('User."email" AS "User.email"');
  });

  it('generates aliases with custom alias', () => {
    const result = aliasColumns('User', 'u');
    expect(result).toContain('u."id" AS "u.id"');
    expect(result).toContain('u."email" AS "u.email"');
  });

  it('generates aliases for specific fields only', () => {
    const result = aliasColumns('User', 'u', ['id', 'email']);
    expect(result).toContain('u."id" AS "u.id"');
    expect(result).toContain('u."email" AS "u.email"');
    expect(result).not.toContain('name');
  });

  it('excludes relation fields', () => {
    const result = aliasColumns('User');
    // Relations like "organizations" should not appear
    expect(result).not.toContain('organizations');
    expect(result).not.toContain('sessions');
  });

  it('throws error for invalid model', () => {
    // @ts-expect-error Testing invalid model type
    expect(() => aliasColumns('InvalidModel')).toThrow('Model "InvalidModel" not found');
  });

  it('throws error when no fields match', () => {
    expect(() => aliasColumns('User', 'u', ['nonexistent'])).toThrow('No matching columns found');
  });
});
