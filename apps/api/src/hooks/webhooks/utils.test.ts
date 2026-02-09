import { describe, expect, it } from 'bun:test';
import {
  getIgnoredFields,
  getRelatedWebhookRefs,
  isNoOpUpdate,
  isWebhookEnabled,
  selectRelevantFields,
} from '#/hooks/webhooks/utils';

describe('webhook utils', () => {
  describe('isWebhookEnabled', () => {
    it('returns false for models not in enabledModels', () => {
      // By default, webhookEnabledModels is empty in template
      expect(isWebhookEnabled('User')).toBe(false);
      expect(isWebhookEnabled('Organization')).toBe(false);
      expect(isWebhookEnabled('NonExistent')).toBe(false);
    });
  });

  describe('getRelatedWebhookRefs', () => {
    it('returns FlexibleRef[] for models with related mappings', () => {
      const userRefs = getRelatedWebhookRefs('User');
      expect(userRefs).toEqual([{ model: 'CustomerRef', axis: 'customerModel', value: 'User' }]);

      const orgRefs = getRelatedWebhookRefs('Organization');
      expect(orgRefs).toEqual([{ model: 'CustomerRef', axis: 'customerModel', value: 'Organization' }]);

      const spaceRefs = getRelatedWebhookRefs('Space');
      expect(spaceRefs).toEqual([
        { model: 'CustomerRef', axis: 'customerModel', value: 'Space' },
        { model: 'CustomerRef', axis: 'providerModel', value: 'Space' },
      ]);
    });

    it('returns null for models without related mappings', () => {
      expect(getRelatedWebhookRefs('NonExistent')).toBe(null);
      expect(getRelatedWebhookRefs('Session')).toBe(null);
    });
  });

  describe('getIgnoredFields', () => {
    it('includes global ignored fields for any model', () => {
      const fields = getIgnoredFields('SomeModel');
      expect(fields).toContain('updatedAt');
    });

    it('includes model-specific ignored fields', () => {
      const tokenFields = getIgnoredFields('Token');
      expect(tokenFields).toContain('updatedAt');
      expect(tokenFields).toContain('lastUsedAt');

      const userFields = getIgnoredFields('User');
      expect(userFields).toContain('updatedAt');
      expect(userFields).toContain('lastLoginAt');
    });

    it('returns only global fields for models without specific config', () => {
      const fields = getIgnoredFields('Organization');
      expect(fields).toEqual(['updatedAt']);
    });
  });

  describe('selectRelevantFields', () => {
    it('strips global ignored fields', () => {
      const data = {
        id: '123',
        name: 'Test',
        updatedAt: new Date(),
      };

      const result = selectRelevantFields('Organization', data);

      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('strips model-specific ignored fields', () => {
      const data = {
        id: '123',
        name: 'Test Token',
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      };

      const result = selectRelevantFields('Token', data);

      expect(result).toEqual({ id: '123', name: 'Test Token' });
      expect(result).not.toHaveProperty('lastUsedAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('preserves fields not in ignored list', () => {
      const data = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const result = selectRelevantFields('User', data);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('isNoOpUpdate', () => {
    it('returns false when no previous data', () => {
      const current = { id: '123', name: 'Test' };
      expect(isNoOpUpdate('User', current, undefined)).toBe(false);
    });

    it('returns true when only ignored fields changed', () => {
      const previous = {
        id: '123',
        name: 'Test',
        updatedAt: new Date('2024-01-01'),
      };
      const current = {
        id: '123',
        name: 'Test',
        updatedAt: new Date('2024-01-02'),
      };

      expect(isNoOpUpdate('User', current, previous)).toBe(true);
    });

    it('returns false when relevant fields changed', () => {
      const previous = {
        id: '123',
        name: 'Old Name',
        updatedAt: new Date('2024-01-01'),
      };
      const current = {
        id: '123',
        name: 'New Name',
        updatedAt: new Date('2024-01-02'),
      };

      expect(isNoOpUpdate('User', current, previous)).toBe(false);
    });

    it('returns true for model-specific ignored field changes', () => {
      const previous = {
        id: '123',
        name: 'Token',
        lastUsedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      const current = {
        id: '123',
        name: 'Token',
        lastUsedAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      };

      expect(isNoOpUpdate('Token', current, previous)).toBe(true);
    });

    it('returns false when non-ignored field changes alongside ignored', () => {
      const previous = {
        id: '123',
        name: 'Old Token',
        lastUsedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      const current = {
        id: '123',
        name: 'New Token',
        lastUsedAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      };

      expect(isNoOpUpdate('Token', current, previous)).toBe(false);
    });
  });
});
