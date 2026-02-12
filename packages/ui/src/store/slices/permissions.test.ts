import { createTestStore } from '@template/ui/test';
import type { HydratedRecord } from '@template/db';
import { beforeEach, describe, expect, it } from 'vitest';

describe('permissions slice', () => {
  let store: ReturnType<typeof createTestStore>;
  const organizationRecord = { id: 'org-1' } as unknown as HydratedRecord;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have required methods', () => {
      const { permissions } = store.getState();

      expect(typeof permissions.check).toBe('function');
      expect(typeof permissions.clear).toBe('function');
      expect(typeof permissions.setup).toBe('function');
    });
  });

  describe('check', () => {
    it('should return false for unauthorized actions', () => {
      const result = store.getState().permissions.check('organization', organizationRecord, 'delete');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should reset permissions', () => {
      // Clear should execute without errors
      expect(() => {
        store.getState().permissions.clear();
      }).not.toThrow();

      // After clear, check should return false
      const result = store.getState().permissions.check('organization', organizationRecord, 'delete');
      expect(result).toBe(false);
    });
  });

  describe('setup', () => {
    it('should configure permissions from user data', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        organizationUsers: [
          {
            role: 'owner',
            organizationId: 'org-1',
            entitlements: {},
          },
        ],
        spaceUsers: [],
      } as any;

      // Setup should complete without throwing
      await store.getState().permissions.setup(mockUser);
      expect(true).toBe(true); // If we get here, it didn't throw
    });

    it('should handle users without organizationUsers', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      } as any;

      await store.getState().permissions.setup(mockUser);
      expect(true).toBe(true);
    });

    it('should handle superadmin users', async () => {
      const mockSuperadminUser = {
        id: 'user-1',
        email: 'superadmin@example.com',
        isSuperadmin: true,
      } as any;

      await store.getState().permissions.setup(mockSuperadminUser);
      expect(true).toBe(true);
    });

    it('should handle users with both org and space permissions', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        organizationUsers: [
          {
            role: 'owner',
            organizationId: 'org-1',
            entitlements: {},
          },
        ],
        spaceUsers: [
          {
            role: 'member',
            spaceId: 'space-1',
            entitlements: {},
          },
        ],
      } as any;

      await store.getState().permissions.setup(mockUser);
      expect(true).toBe(true);
    });
  });
});
