import { describe, expect, it } from 'bun:test';
import { buildNestedPath, isValidPathNotation } from '#/lib/prisma/pathNotation';

describe('pathNotation', () => {
  describe('buildNestedPath', () => {
    it('builds single-level path', () => {
      const result = buildNestedPath('name', 'asc');
      expect(result).toEqual({ name: 'asc' });
    });

    it('builds two-level nested path', () => {
      const result = buildNestedPath('user.email', 'asc');
      expect(result).toEqual({ user: { email: 'asc' } });
    });

    it('builds three-level nested path', () => {
      const result = buildNestedPath('organization.user.name', 'desc');
      expect(result).toEqual({ organization: { user: { name: 'desc' } } });
    });

    it('builds deep nested path with complex value', () => {
      const result = buildNestedPath('a.b.c.d', { contains: 'test', mode: 'insensitive' });
      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: { contains: 'test', mode: 'insensitive' },
            },
          },
        },
      });
    });
  });

  describe('isValidPathNotation', () => {
    it('accepts valid single field', () => {
      expect(isValidPathNotation('name')).toBe(true);
      expect(isValidPathNotation('email')).toBe(true);
      expect(isValidPathNotation('createdAt')).toBe(true);
    });

    it('accepts valid nested paths', () => {
      expect(isValidPathNotation('user.email')).toBe(true);
      expect(isValidPathNotation('organization.name')).toBe(true);
      expect(isValidPathNotation('a.b.c.d')).toBe(true);
    });

    it('rejects special characters', () => {
      expect(isValidPathNotation('user$email')).toBe(false);
      expect(isValidPathNotation('user@email')).toBe(false);
      expect(isValidPathNotation('user/email')).toBe(false);
      expect(isValidPathNotation('user\\email')).toBe(false);
    });

    it('rejects directory traversal attempts', () => {
      expect(isValidPathNotation('..')).toBe(false);
      expect(isValidPathNotation('user..email')).toBe(false);
      expect(isValidPathNotation('../user')).toBe(false);
    });

    it('rejects paths exceeding max depth', () => {
      expect(isValidPathNotation('a.b.c.d.e', 4)).toBe(false);
      expect(isValidPathNotation('a.b.c.d.e', 5)).toBe(true);
    });

    it('accepts alphanumeric with dots', () => {
      expect(isValidPathNotation('user123.email456')).toBe(true);
      expect(isValidPathNotation('field1.field2.field3')).toBe(true);
    });

    it('accepts Prisma meta-fields with leading underscore', () => {
      expect(isValidPathNotation('_count')).toBe(true);
      expect(isValidPathNotation('_max')).toBe(true);
      expect(isValidPathNotation('_min')).toBe(true);
      expect(isValidPathNotation('user._count')).toBe(true);
      expect(isValidPathNotation('organization.members._count')).toBe(true);
    });

    it('rejects snake_case (underscores in middle)', () => {
      expect(isValidPathNotation('user_name')).toBe(false);
      expect(isValidPathNotation('created_at')).toBe(false);
      expect(isValidPathNotation('organization.created_at')).toBe(false);
      expect(isValidPathNotation('user.first_name')).toBe(false);
    });
  });
});
