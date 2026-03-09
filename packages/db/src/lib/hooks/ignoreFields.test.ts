import { describe, expect, it } from 'bun:test';
import { filterIgnoredFields, getIgnoreFields, HOOK_IGNORE_FIELDS } from '@template/db/lib/hooks';

describe('ignoreFields', () => {
  describe('HOOK_IGNORE_FIELDS', () => {
    it('has _global field with updatedAt', () => {
      expect(HOOK_IGNORE_FIELDS._global).toContain('updatedAt');
    });
  });

  describe('getIgnoreFields', () => {
    it('returns global fields for unknown model', () => {
      const fields = getIgnoreFields('UnknownModel');
      expect(fields).toContain('updatedAt');
    });

    it('includes model-specific fields in addition to global fields', () => {
      const fields = getIgnoreFields('User');
      expect(fields).toContain('updatedAt');
      expect(fields).toContain('lastLoginAt');
    });

    it('includes Token-specific fields', () => {
      const fields = getIgnoreFields('Token');
      expect(fields).toContain('updatedAt');
      expect(fields).toContain('lastUsedAt');
    });
  });

  describe('filterIgnoredFields', () => {
    it('removes global updatedAt from all models', () => {
      const data = { id: '1', name: 'test', updatedAt: new Date() };
      const result = filterIgnoredFields('Organization', data);
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('name', 'test');
    });

    it('removes model-specific fields for User', () => {
      const data = { id: '1', email: 'test@example.com', updatedAt: new Date(), lastLoginAt: new Date() };
      const result = filterIgnoredFields('User', data);
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('lastLoginAt');
      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('removes lastUsedAt for Token', () => {
      const data = { id: '1', name: 'my-token', updatedAt: new Date(), lastUsedAt: new Date() };
      const result = filterIgnoredFields('Token', data);
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('lastUsedAt');
      expect(result).toHaveProperty('name', 'my-token');
    });

    it('preserves other fields for unknown model', () => {
      const data = { id: '1', status: 'active', createdAt: new Date(), updatedAt: new Date() };
      const result = filterIgnoredFields('SomeModel', data);
      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });
});
