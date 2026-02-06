import { describe, expect, it } from 'bun:test';
import { buildNestedPath, validatePathNotation } from './pathNotation';

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

  describe('validatePathNotation', () => {
    it('accepts valid single field', () => {
      expect(validatePathNotation('name')).toBe(true);
      expect(validatePathNotation('email')).toBe(true);
      expect(validatePathNotation('createdAt')).toBe(true);
    });

    it('accepts valid nested paths', () => {
      expect(validatePathNotation('user.email')).toBe(true);
      expect(validatePathNotation('organization.name')).toBe(true);
      expect(validatePathNotation('a.b.c.d')).toBe(true);
    });

    it('rejects special characters', () => {
      expect(validatePathNotation('user$email')).toBe(false);
      expect(validatePathNotation('user@email')).toBe(false);
      expect(validatePathNotation('user/email')).toBe(false);
      expect(validatePathNotation('user\\email')).toBe(false);
    });

    it('rejects directory traversal attempts', () => {
      expect(validatePathNotation('..')).toBe(false);
      expect(validatePathNotation('user..email')).toBe(false);
      expect(validatePathNotation('../user')).toBe(false);
    });

    it('rejects paths exceeding max depth', () => {
      expect(validatePathNotation('a.b.c.d.e', 4)).toBe(false);
      expect(validatePathNotation('a.b.c.d.e', 5)).toBe(true);
    });

    it('accepts alphanumeric with dots', () => {
      expect(validatePathNotation('user123.email456')).toBe(true);
      expect(validatePathNotation('field1.field2.field3')).toBe(true);
    });
  });
});
