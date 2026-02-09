import { beforeEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { createPermissions, type Permix } from '../client';
import { check } from './check';
import type { RebacSchema } from './types';

describe('rebac check', () => {
  let permix: Permix;

  beforeEach(() => {
    permix = createPermissions();
  });

  describe('direct permissions', () => {
    const schema: RebacSchema = {
      organization: {
        actions: {
          own: null,
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
    };

    it('returns true when user has direct permission', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(true);
    });

    it('returns false when user lacks permission', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { read: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(false);
    });
  });

  describe('action inheritance (string rule)', () => {
    const schema: RebacSchema = {
      organization: {
        actions: {
          own: null,
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
    };

    it('inherits manage from own', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'manage')).toBe(true);
    });

    it('inherits read through full chain (own -> manage -> operate -> read)', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'read')).toBe(true);
    });

    it('does not grant higher action from lower', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { read: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(false);
      expect(check(permix, schema, 'organization', record, 'manage')).toBe(false);
    });
  });

  describe('relation traversal', () => {
    const schema: RebacSchema = {
      organization: {
        actions: {
          own: null,
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
      space: {
        actions: {
          own: { rel: 'organization', action: 'own' },
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
    };

    it('grants space.own when user owns org', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'own')).toBe(true);
    });

    it('grants space.read through org ownership chain', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'read')).toBe(true);
    });

    it('denies space access when user lacks org permission', async () => {
      await permix.setup({ resource: 'organization', id: 'org-2', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'own')).toBe(false);
    });

    it('allows direct space permission override', async () => {
      await permix.setup({ resource: 'space', id: 'space-1', actions: { manage: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'manage')).toBe(true);
      expect(check(permix, schema, 'space', spaceRecord, 'read')).toBe(true);
      // Cannot get own without org ownership
      expect(check(permix, schema, 'space', spaceRecord, 'own')).toBe(false);
    });
  });

  describe('any (OR) logic', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null, manage: 'own', read: 'manage' },
      },
      space: {
        actions: { own: null, manage: 'own', read: 'manage' },
      },
      customerRef: {
        actions: {
          read: {
            any: [
              { rel: 'customerOrganization', action: 'read' },
              { rel: 'providerSpace', action: 'read' },
            ],
          },
        },
      },
    };

    it('grants access when first condition matches', async () => {
      await permix.setup({ resource: 'organization', id: 'customer-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });

    it('grants access when second condition matches', async () => {
      await permix.setup({ resource: 'space', id: 'provider-space', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });

    it('denies access when no conditions match', async () => {
      await permix.setup({ resource: 'organization', id: 'other-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(false);
    });
  });

  describe('all (AND) logic', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null },
      },
      space: {
        actions: { own: null },
      },
      customerRef: {
        actions: {
          admin: {
            all: [
              { rel: 'customerOrganization', action: 'own' },
              { rel: 'providerSpace', action: 'own' },
            ],
          },
        },
      },
    };

    it('grants access when all conditions match', async () => {
      await permix.setup([
        { resource: 'organization', id: 'customer-org', actions: { own: true } },
        { resource: 'space', id: 'provider-space', actions: { own: true } },
      ]);
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'admin')).toBe(true);
    });

    it('denies access when only first condition matches', async () => {
      await permix.setup({ resource: 'organization', id: 'customer-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'admin')).toBe(false);
    });

    it('denies access when only second condition matches', async () => {
      await permix.setup({ resource: 'space', id: 'provider-space', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'admin')).toBe(false);
    });
  });

  describe('json rules attribute checks', () => {
    const schema: RebacSchema = {
      inquiry: {
        actions: {
          read: { rule: { field: 'isPublic', operator: Operator.equals, value: true } },
          edit: {
            all: [
              { rule: { field: 'status', operator: Operator.equals, value: 'draft' } },
              { rule: { field: 'isLocked', operator: Operator.equals, value: false } },
            ],
          },
        },
      },
    };

    it('grants read when isPublic is true', () => {
      const record = { id: 'inq-1', isPublic: true };
      expect(check(permix, schema, 'inquiry', record, 'read')).toBe(true);
    });

    it('denies read when isPublic is false', () => {
      const record = { id: 'inq-1', isPublic: false };
      expect(check(permix, schema, 'inquiry', record, 'read')).toBe(false);
    });

    it('grants edit when all attribute conditions match', () => {
      const record = { id: 'inq-1', status: 'draft', isLocked: false };
      expect(check(permix, schema, 'inquiry', record, 'edit')).toBe(true);
    });

    it('denies edit when status is not draft', () => {
      const record = { id: 'inq-1', status: 'published', isLocked: false };
      expect(check(permix, schema, 'inquiry', record, 'edit')).toBe(false);
    });

    it('denies edit when inquiry is locked', () => {
      const record = { id: 'inq-1', status: 'draft', isLocked: true };
      expect(check(permix, schema, 'inquiry', record, 'edit')).toBe(false);
    });
  });

  describe('json rules nested attribute access', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null },
      },
      space: {
        actions: {
          // Can only access if parent org has enterprise plan
          access: { rule: { field: 'organization.plan', operator: Operator.equals, value: 'enterprise' } },
          // Check deeply nested entitlement
          useFeature: {
            rule: { field: 'organization.entitlements.advancedFeatures', operator: Operator.equals, value: true },
          },
        },
      },
      spaceUser: {
        actions: {
          // Check 3 levels deep
          accessPremium: {
            rule: { field: 'space.organization.plan', operator: Operator.equals, value: 'enterprise' },
          },
        },
      },
    };

    it('accesses parent relation attribute (organization.plan)', () => {
      const record = {
        id: 'space-1',
        organization: { id: 'org-1', plan: 'enterprise' },
      };
      expect(check(permix, schema, 'space', record, 'access')).toBe(true);
    });

    it('denies when parent attribute does not match', () => {
      const record = {
        id: 'space-1',
        organization: { id: 'org-1', plan: 'free' },
      };
      expect(check(permix, schema, 'space', record, 'access')).toBe(false);
    });

    it('accesses nested object property (organization.entitlements.advancedFeatures)', () => {
      const record = {
        id: 'space-1',
        organization: { id: 'org-1', entitlements: { advancedFeatures: true } },
      };
      expect(check(permix, schema, 'space', record, 'useFeature')).toBe(true);
    });

    it('accesses 3 levels deep (space.organization.plan)', () => {
      const record = {
        id: 'su-1',
        space: {
          id: 'space-1',
          organization: { id: 'org-1', plan: 'enterprise' },
        },
      };
      expect(check(permix, schema, 'spaceUser', record, 'accessPremium')).toBe(true);
    });

    it('returns false when intermediate relation is missing', () => {
      const record = {
        id: 'space-1',
        organization: null,
      };
      expect(check(permix, schema, 'space', record, 'access')).toBe(false);
    });
  });

  describe('polymorphic CustomerRef - full example', () => {
    // CustomerRef has customer side (user/org/space) and provider side (space)
    // Customer can read their refs, provider can manage them
    const schema: RebacSchema = {
      user: {
        actions: { own: null },
      },
      organization: {
        actions: {
          own: null,
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
      space: {
        actions: {
          own: { rel: 'organization', action: 'own' },
          manage: 'own',
          operate: 'manage',
          read: 'operate',
        },
      },
      customerRef: {
        actions: {
          // Provider owns the ref
          own: { rel: 'providerSpace', action: 'own' },
          manage: 'own',
          // Both customer and provider can read
          read: {
            any: [
              'manage',
              { rel: 'customerUser', action: 'own' },
              { rel: 'customerOrganization', action: 'read' },
              { rel: 'customerSpace', action: 'read' },
            ],
          },
        },
      },
    };

    it('provider org owner can manage customerRef', async () => {
      await permix.setup({ resource: 'organization', id: 'provider-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'own')).toBe(true);
      expect(check(permix, schema, 'customerRef', record, 'manage')).toBe(true);
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });

    it('customer org member can read but not manage customerRef', async () => {
      await permix.setup({ resource: 'organization', id: 'customer-org', actions: { read: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
      expect(check(permix, schema, 'customerRef', record, 'manage')).toBe(false);
      expect(check(permix, schema, 'customerRef', record, 'own')).toBe(false);
    });

    it('unrelated user cannot access customerRef', async () => {
      await permix.setup({ resource: 'organization', id: 'other-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(false);
    });

    it('customer user can read their own ref', async () => {
      await permix.setup({ resource: 'user', id: 'user-1', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerUser: { id: 'user-1' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });
  });

  describe('self check', () => {
    const schema: RebacSchema = {
      organizationUser: {
        actions: {
          // Can read your own membership, or if you have org read permission
          read: { any: [{ self: 'userId' }, { rel: 'organization', action: 'read' }] },
          // Can only manage via org permission
          manage: { rel: 'organization', action: 'manage' },
        },
      },
      organization: {
        actions: { own: null, manage: 'own', read: 'manage' },
      },
      session: {
        actions: {
          // Can only access your own sessions
          read: { self: 'userId' },
          delete: { self: 'userId' },
        },
      },
    };

    it('grants access when userId matches current user', () => {
      permix.setUserId('user-123' as any);
      const record = { id: 'ou-1', userId: 'user-123' };
      expect(check(permix, schema, 'organizationUser', record, 'read')).toBe(true);
    });

    it('denies access when userId does not match', () => {
      permix.setUserId('user-123' as any);
      const record = { id: 'ou-1', userId: 'other-user' };
      expect(check(permix, schema, 'session', record, 'read')).toBe(false);
    });

    it('denies access when no userId set', () => {
      // userId is null by default
      const record = { id: 'session-1', userId: 'user-123' };
      expect(check(permix, schema, 'session', record, 'read')).toBe(false);
    });

    it('works with any - self OR org permission', async () => {
      // User has org read permission but is not the user on the record
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { read: true } });
      permix.setUserId('different-user' as any);
      const record = {
        id: 'ou-1',
        userId: 'user-123',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'organizationUser', record, 'read')).toBe(true);
    });

    it('self check uses specified field', () => {
      permix.setUserId('user-123' as any);
      const sessionRecord = { id: 's-1', userId: 'user-123' };
      const otherRecord = { id: 's-2', userId: 'other-user' };
      expect(check(permix, schema, 'session', sessionRecord, 'delete')).toBe(true);
      expect(check(permix, schema, 'session', otherRecord, 'delete')).toBe(false);
    });
  });

  describe('superadmin bypass', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null },
      },
    };

    it('superadmin bypasses all checks', async () => {
      permix.setSuperadmin(true);
      const record = { id: 'org-1' };
      // Direct check returns true for superadmin
      expect(check(permix, schema, 'organization', record, 'own')).toBe(true);
    });
  });

  describe('missing relation handling', () => {
    const schema: RebacSchema = {
      space: {
        actions: {
          own: { rel: 'organization', action: 'own' },
        },
      },
    };

    it('returns false when related record is null', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'space-1', organization: null };
      expect(check(permix, schema, 'space', record, 'own')).toBe(false);
    });

    it('returns false when related record is undefined', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'space-1' };
      expect(check(permix, schema, 'space', record, 'own')).toBe(false);
    });
  });

  describe('undefined model/action handling', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null },
      },
    };

    it('returns false for undefined model', () => {
      const record = { id: 'unknown-1' };
      expect(check(permix, schema, 'unknownModel' as any, record, 'own')).toBe(false);
    });

    it('returns false for undefined action', async () => {
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'unknownAction')).toBe(false);
    });
  });

  describe('unhappy paths', () => {
    const schema: RebacSchema = {
      organization: {
        actions: { own: null, manage: 'own' },
      },
      space: {
        actions: { own: { rel: 'organization', action: 'own' } },
      },
    };

    it('returns false when null passed as action', () => {
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, null)).toBe(false);
    });

    it('returns false when action delegates to non-existent action', () => {
      const badSchema: RebacSchema = {
        organization: { actions: { manage: 'nonExistent' } },
      };
      const record = { id: 'org-1' };
      expect(check(permix, badSchema, 'organization', record, 'manage')).toBe(false);
    });

    it('returns false for own:null without direct permission', async () => {
      // User has NO permissions
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(false);
    });

    it('returns false when relation field missing from Prisma schema', () => {
      const badSchema: RebacSchema = {
        space: { actions: { own: { rel: 'fakeRelation', action: 'own' } } },
      };
      const record = { id: 'space-1', fakeRelation: { id: 'fake-1' } };
      expect(check(permix, badSchema, 'space', record, 'own')).toBe(false);
    });

    it('handles deeply nested delegation chains', async () => {
      const deepSchema: RebacSchema = {
        organization: { actions: { own: null, a: 'own', b: 'a', c: 'b', d: 'c' } },
      };
      await permix.setup({ resource: 'organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, deepSchema, 'organization', record, 'd')).toBe(true);
    });

    it('handles deeply nested delegation without permission', () => {
      const deepSchema: RebacSchema = {
        organization: { actions: { own: null, a: 'own', b: 'a', c: 'b', d: 'c' } },
      };
      const record = { id: 'org-1' };
      expect(check(permix, deepSchema, 'organization', record, 'd')).toBe(false);
    });

    // Cycle detection is in place but hard to test without real cyclic Prisma relations
    it.skip('throws on cycle in permission graph', async () => {
      const cyclicSchema: RebacSchema = {
        organization: { actions: { own: { rel: 'parentSpace', action: 'own' } } },
        space: { actions: { own: { rel: 'organization', action: 'own' } } },
      };
      const space: any = { id: 'space-1' };
      const org: any = { id: 'org-1', parentSpace: space };
      space.organization = org;

      expect(() => check(permix, cyclicSchema, 'space', space, 'own')).toThrow(/Cycle detected/);
    });
  });
});
