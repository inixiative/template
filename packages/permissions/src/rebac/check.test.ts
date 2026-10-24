import { beforeEach, describe, expect, it } from 'bun:test';
import { type Bridge, Operator } from '@inixiative/json-rules';
import { createRebacCheck } from '@inixiative/permissions';
import type { AccessorName } from '@template/db';
import { createPermissions, type Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';

describe('rebac check', () => {
  let permix: Permix;

  beforeEach(() => {
    permix = createPermissions();
  });

  describe('direct permissions', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: {
            own: null,
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
      },
    };

    it('returns true when user has direct permission', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(true);
    });

    it('returns false when user lacks permission', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { read: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(false);
    });
  });

  describe('action inheritance (string rule)', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: {
            own: null,
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
      },
    };

    it('inherits manage from own', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'manage')).toBe(true);
    });

    it('inherits read through full chain (own -> manage -> operate -> read)', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'read')).toBe(true);
    });

    it('does not grant higher action from lower', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { read: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'own')).toBe(false);
      expect(check(permix, schema, 'organization', record, 'manage')).toBe(false);
    });
  });

  describe('relation traversal', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: {
            own: null,
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
        'db:space': {
          actions: {
            own: { rel: 'organization', action: 'own' },
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
      },
    };

    it('grants space.own when user owns org', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'own')).toBe(true);
    });

    it('grants space.read through org ownership chain', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'read')).toBe(true);
    });

    it('denies space access when user lacks org permission', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-2', actions: { own: true } });
      const spaceRecord = {
        id: 'space-1',
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'space', spaceRecord, 'own')).toBe(false);
    });

    it('allows direct space permission override', async () => {
      await permix.setup({ resource: 'db:space', id: 'space-1', actions: { manage: true } });
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
      permissions: {
        'db:organization': {
          actions: { own: null, manage: 'own', read: 'manage' },
        },
        'db:space': {
          actions: { own: null, manage: 'own', read: 'manage' },
        },
        'db:customerRef': {
          actions: {
            read: {
              any: [
                { rel: 'customerOrganization', action: 'read' },
                { rel: 'providerSpace', action: 'read' },
              ],
            },
          },
        },
      },
    };

    it('grants access when first condition matches', async () => {
      await permix.setup({
        resource: 'db:organization',
        id: 'customer-org',
        actions: { own: true },
      });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });

    it('grants access when second condition matches', async () => {
      await permix.setup({ resource: 'db:space', id: 'provider-space', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });

    it('denies access when no conditions match', async () => {
      await permix.setup({ resource: 'db:organization', id: 'other-org', actions: { own: true } });
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
      permissions: {
        'db:organization': {
          actions: { own: null },
        },
        'db:space': {
          actions: { own: null },
        },
        'db:customerRef': {
          actions: {
            admin: {
              all: [
                { rel: 'customerOrganization', action: 'own' },
                { rel: 'providerSpace', action: 'own' },
              ],
            },
          },
        },
      },
    };

    it('grants access when all conditions match', async () => {
      await permix.setup([
        { resource: 'db:organization', id: 'customer-org', actions: { own: true } },
        { resource: 'db:space', id: 'provider-space', actions: { own: true } },
      ]);
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'admin')).toBe(true);
    });

    it('denies access when only first condition matches', async () => {
      await permix.setup({
        resource: 'db:organization',
        id: 'customer-org',
        actions: { own: true },
      });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space' },
      };
      expect(check(permix, schema, 'customerRef', record, 'admin')).toBe(false);
    });

    it('denies access when only second condition matches', async () => {
      await permix.setup({ resource: 'db:space', id: 'provider-space', actions: { own: true } });
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
      permissions: {
        'db:inquiry': {
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
      permissions: {
        'db:organization': {
          actions: { own: null },
        },
        'db:space': {
          actions: {
            // Can only access if parent org has enterprise plan
            access: {
              rule: { field: 'organization.plan', operator: Operator.equals, value: 'enterprise' },
            },
            // Check deeply nested entitlement
            useFeature: {
              rule: {
                field: 'organization.entitlements.advancedFeatures',
                operator: Operator.equals,
                value: true,
              },
            },
          },
        },
        'db:spaceUser': {
          actions: {
            // Check 3 levels deep
            accessPremium: {
              rule: {
                field: 'space.organization.plan',
                operator: Operator.equals,
                value: 'enterprise',
              },
            },
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
      permissions: {
        'db:user': {
          actions: { own: null },
        },
        'db:organization': {
          actions: {
            own: null,
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
        'db:space': {
          actions: {
            own: { rel: 'organization', action: 'own' },
            manage: 'own',
            operate: 'manage',
            read: 'operate',
          },
        },
        'db:customerRef': {
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
      },
    };

    it('provider org owner can manage customerRef', async () => {
      await permix.setup({
        resource: 'db:organization',
        id: 'provider-org',
        actions: { own: true },
      });
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
      await permix.setup({
        resource: 'db:organization',
        id: 'customer-org',
        actions: { read: true },
      });
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
      await permix.setup({ resource: 'db:organization', id: 'other-org', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerOrganization: { id: 'customer-org' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(false);
    });

    it('customer user can read their own ref', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-1', actions: { own: true } });
      const record = {
        id: 'ref-1',
        customerUser: { id: 'user-1' },
        providerSpace: { id: 'provider-space', organization: { id: 'provider-org' } },
      };
      expect(check(permix, schema, 'customerRef', record, 'read')).toBe(true);
    });
  });

  describe('the actor arm and the user relation', () => {
    const person: ActionRule = {
      actor: { field: 'model', operator: Operator.equals, value: 'User' },
    };
    const schema: RebacSchema = {
      permissions: {
        'db:user': {
          actions: {
            own: null,
            operate: 'own',
            read: 'operate',
            mint: { all: [person, 'operate'] },
          },
        },
        'db:organizationUser': {
          actions: {
            read: {
              any: [
                { rel: 'user', action: 'read' },
                { rel: 'organization', action: 'read' },
              ],
            },
          },
        },
        'db:organization': {
          actions: { own: null, manage: 'own', read: 'manage' },
        },
      },
    };

    it('a person holding the action passes an actor-gated arm', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-123', actions: { own: true } });
      permix.setActor({ id: 'user-123', model: 'User' });
      expect(check(permix, schema, 'user', { id: 'user-123' }, 'mint')).toBe(true);
    });

    it('a token holding the same grant does not', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-123', actions: { own: true } });
      permix.setActor({ id: 't-1', model: 'Token' });
      expect(check(permix, schema, 'user', { id: 'user-123' }, 'mint')).toBe(false);
      expect(check(permix, schema, 'user', { id: 'user-123' }, 'own')).toBe(true);
    });

    it('with nobody acting the arm denies and the table still answers', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-123', actions: { own: true } });
      expect(check(permix, schema, 'user', { id: 'user-123' }, 'mint')).toBe(false);
      expect(check(permix, schema, 'user', { id: 'user-123' }, 'own')).toBe(true);
    });

    it('your own row is reached through its user relation, hydrated', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-123', actions: { read: true } });
      const mine = { id: 'ou-1', userId: 'user-123', user: { id: 'user-123' } };
      const theirs = { id: 'ou-2', userId: 'other-user', user: { id: 'other-user' } };
      const bare = { id: 'ou-1', userId: 'user-123' };
      expect(check(permix, schema, 'organizationUser', mine, 'read')).toBe(true);
      expect(check(permix, schema, 'organizationUser', theirs, 'read')).toBe(false);
      expect(check(permix, schema, 'organizationUser', bare, 'read')).toBe(false);
    });

    it('works with any: the user relation or the organization', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { read: true } });
      const record = {
        id: 'ou-1',
        userId: 'user-123',
        user: { id: 'user-123' },
        organization: { id: 'org-1' },
      };
      expect(check(permix, schema, 'organizationUser', record, 'read')).toBe(true);
    });
  });

  describe('superadmin bypass', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: { own: null },
        },
      },
    };

    it('superadmin bypasses all checks', async () => {
      permix.setSuperadmin(true);
      const record = { id: 'org-1' };
      // Direct check returns true for superadmin
      expect(check(permix, schema, 'organization', record, 'own')).toBe(true);
    });
  });

  describe('dot-path rel traversal (multi-hop)', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: {
            own: null,
            manage: 'own',
          },
        },
        'db:space': {
          actions: {
            own: { rel: 'organization', action: 'own' },
            manage: 'own',
          },
        },
        'db:inquiry': {
          actions: {
            // updateSpace: space owner or org owner (space.own delegates to org.own)
            updateSpace: { rel: 'sourceSpace', action: 'own' },
            // transferSpace: org owner only — explicit 2-hop bypasses direct space.own
            transferSpace: { rel: 'sourceSpace.organization', action: 'own' },
          },
        },
      },
    };

    it('single-hop rel works as before', async () => {
      await permix.setup({ resource: 'db:space', id: 'space-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1', organization: { id: 'org-1' } },
      };
      expect(check(permix, schema, 'inquiry', record, 'updateSpace')).toBe(true);
    });

    it('two-hop dot-path: grants access when org owner', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1', organization: { id: 'org-1' } },
      };
      expect(check(permix, schema, 'inquiry', record, 'transferSpace')).toBe(true);
    });

    it('two-hop dot-path: denies when only space owner (not org owner)', async () => {
      await permix.setup({ resource: 'db:space', id: 'space-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1', organization: { id: 'org-1' } },
      };
      // transferSpace explicitly traverses to org — direct space.own is not enough
      expect(check(permix, schema, 'inquiry', record, 'transferSpace')).toBe(false);
    });

    it('two-hop dot-path: updateSpace allows space owner (via delegation to org.own)', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1', organization: { id: 'org-1' } },
      };
      // space.own delegates to org.own, so org owner passes updateSpace too
      expect(check(permix, schema, 'inquiry', record, 'updateSpace')).toBe(true);
    });

    it('two-hop dot-path: returns false when intermediate relation is missing', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1' }, // no organization
      };
      expect(check(permix, schema, 'inquiry', record, 'transferSpace')).toBe(false);
    });

    it('two-hop dot-path: returns false when first segment relation is missing', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = {
        id: 'inq-1',
        // no sourceSpace at all
      };
      expect(check(permix, schema, 'inquiry', record, 'transferSpace')).toBe(false);
    });

    it('two-hop dot-path: returns false when wrong org', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-2', actions: { own: true } });
      const record = {
        id: 'inq-1',
        sourceSpace: { id: 'space-1', organization: { id: 'org-1' } },
      };
      expect(check(permix, schema, 'inquiry', record, 'transferSpace')).toBe(false);
    });
  });

  describe('missing relation handling', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:space': {
          actions: {
            own: { rel: 'organization', action: 'own' },
          },
        },
      },
    };

    it('returns false when related record is null', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'space-1', organization: null };
      expect(check(permix, schema, 'space', record, 'own')).toBe(false);
    });

    it('returns false when related record is undefined', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'space-1' };
      expect(check(permix, schema, 'space', record, 'own')).toBe(false);
    });
  });

  describe('undefined model/action handling', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: { own: null },
        },
      },
    };

    it('returns false for undefined model', () => {
      const record = { id: 'unknown-1' };
      expect(check(permix, schema, 'unknownModel' as unknown as AccessorName, record, 'own')).toBe(
        false,
      );
    });

    it('returns false for undefined action', async () => {
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, 'unknownAction')).toBe(false);
    });
  });

  describe('unhappy paths', () => {
    const schema: RebacSchema = {
      permissions: {
        'db:organization': {
          actions: { own: null, manage: 'own' },
        },
        'db:space': {
          actions: { own: { rel: 'organization', action: 'own' } },
        },
      },
    };

    it('returns false when null passed as action', () => {
      const record = { id: 'org-1' };
      expect(check(permix, schema, 'organization', record, null)).toBe(false);
    });

    it('returns false when action delegates to non-existent action', () => {
      const badSchema: RebacSchema = {
        permissions: { 'db:organization': { actions: { manage: 'nonExistent' } } },
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
        permissions: { 'db:space': { actions: { own: { rel: 'fakeRelation', action: 'own' } } } },
      };
      const record = { id: 'space-1', fakeRelation: { id: 'fake-1' } };
      expect(check(permix, badSchema, 'space', record, 'own')).toBe(false);
    });

    it('handles deeply nested delegation chains', async () => {
      const deepSchema: RebacSchema = {
        permissions: {
          'db:organization': { actions: { own: null, a: 'own', b: 'a', c: 'b', d: 'c' } },
        },
      };
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { own: true } });
      const record = { id: 'org-1' };
      expect(check(permix, deepSchema, 'organization', record, 'd')).toBe(true);
    });

    it('handles deeply nested delegation without permission', () => {
      const deepSchema: RebacSchema = {
        permissions: {
          'db:organization': { actions: { own: null, a: 'own', b: 'a', c: 'b', d: 'c' } },
        },
      };
      const record = { id: 'org-1' };
      expect(check(permix, deepSchema, 'organization', record, 'd')).toBe(false);
    });

    it('throws on cycle in permission graph', () => {
      // The prisma map template bakes into `check` has no cycle, so generate a relation map with a
      // real space <-> organization cycle and drive the imported engine with it directly.
      const relations: Record<string, Record<string, string>> = {
        space: { organization: 'organization' },
        organization: { parentSpace: 'space' },
      };
      const cyclicCheck = createRebacCheck((model, segment) => relations[model]?.[segment] ?? null);
      const cyclicSchema = {
        permissions: {
          organization: { actions: { own: { rel: 'parentSpace', action: 'own' } } },
          space: { actions: { own: { rel: 'organization', action: 'own' } } },
        },
      };
      const space: Record<string, unknown> = { id: 'space-1' };
      const org: Record<string, unknown> = { id: 'org-1', parentSpace: space };
      space.organization = org;

      // No grants — forces schema evaluation down the cyclic relation walk.
      const noGrants = { check: () => false, isSuperadmin: () => false, getActor: () => null };
      expect(() =>
        cyclicCheck(noGrants, cyclicSchema, { resource: 'space', record: space }, 'own'),
      ).toThrow(/Cycle detected/);
    });
  });

  describe('row-level permissionRules (additive extension)', () => {
    // Contact-shaped schema: read inherits all the way up from manage from own.
    // The owner (through the user relation) and admins-via-org pass via schema. Row-level
    // permissionRules can grant additional read paths without restricting.
    const schema: RebacSchema = {
      permissions: {
        'db:contact': {
          actions: {
            own: null,
            manage: 'own',
            read: 'manage',
          },
        },
        'db:organization': {
          actions: { own: null, manage: 'own', read: 'manage' },
        },
        'db:user': { actions: { read: null } },
      },
    };

    it('null permissionRules behaves like schema-only', async () => {
      const record = { id: 'c-1', userId: 'user-1', permissionRules: null };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(false);
    });

    it('row rule for one action does not affect another action', async () => {
      // Row rule keyed under `delete` is irrelevant when checking `read`.
      // Schema requires own (not granted) and there's no read row rule → deny.
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { delete: { all: [] } as never },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(false);
    });

    it('grants access via row rule that schema would deny', async () => {
      // Schema requires own → no direct permission means denied. Row rule
      // grants any authenticated check via tautology rule.
      await permix.setup({ resource: 'db:user', id: 'user-1', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { rel: 'user', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });

    it('grants when only schema rule passes (row rule does not match)', async () => {
      // Schema grants via direct permission. Row rule is a self-check that
      // would fail (different userId), but additive merge keeps schema floor.
      await permix.setup({ resource: 'db:contact', id: 'c-1', actions: { own: true } });
      await permix.setup({ resource: 'db:user', id: 'different-user', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { rel: 'user', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });

    it('grants when both schema and row rule pass', async () => {
      await permix.setup({ resource: 'db:contact', id: 'c-1', actions: { own: true } });
      await permix.setup({ resource: 'db:user', id: 'user-1', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { rel: 'user', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });

    it('denies when neither schema nor row rule grants', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-2', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { rel: 'user', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(false);
    });

    it('row rule with { rel, action } delegates to related model rebac', async () => {
      // Schema would deny (no contact.read direct). Row rule says: anyone
      // who can read the contact's organization can also read it.
      await permix.setup({ resource: 'db:organization', id: 'org-1', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        organization: { id: 'org-1' },
        permissionRules: { read: { rel: 'organization', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });

    it('row rule with composed any/all works via additive merge', async () => {
      await permix.setup({ resource: 'db:user', id: 'user-1', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        // Either self or some attribute predicate would grant
        permissionRules: {
          read: {
            any: [
              { rel: 'user', action: 'read' },
              { rule: { field: 'shareToken', operator: Operator.equals, value: 'public' } },
            ],
          },
        },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });

    it('row rule does not affect actions other than the keyed one', async () => {
      // Row rule grants `read` but the request asks for `manage`. The merge
      // happens per action — manage falls back to schema only.
      await permix.setup({ resource: 'db:user', id: 'user-1', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { all: [] } as never }, // would grant read
      };
      expect(check(permix, schema, 'contact', record, 'manage')).toBe(false);
    });

    it('schema floor: row rule cannot restrict below the schema default', async () => {
      // Schema grants read via own (direct permission). Row rule says self
      // must equal userId — but the requesting user is different. Additive
      // merge keeps the schema path open.
      await permix.setup({ resource: 'db:contact', id: 'c-1', actions: { own: true } });
      await permix.setup({ resource: 'db:user', id: 'different-user', actions: { read: true } });
      const record = {
        id: 'c-1',
        userId: 'user-1',
        user: { id: 'user-1' },
        permissionRules: { read: { rel: 'user', action: 'read' } },
      };
      expect(check(permix, schema, 'contact', record, 'read')).toBe(true);
    });
  });

  describe('cross-source bridge walks', () => {
    // crm:account (the "one") ↔ db:user (the "many"); db:user.accountId joins crm:account.id.
    const bridges: Bridge[] = [
      {
        endpoints: [
          { fieldMap: 'crm', model: 'account', on: 'id' },
          { fieldMap: 'db', model: 'user', on: 'accountId' },
        ],
        cardinality: 'oneToMany',
      },
    ];

    it('rbac-terminal: walks the bridge via the join scalar to a grant on the far (crm) resource', async () => {
      const schema: RebacSchema = {
        bridges,
        permissions: {
          'db:user': { actions: { read: { rel: 'crm:account', action: 'read' } } },
          'crm:account': { actions: { read: null } },
        },
      };
      await permix.setup({ resource: 'crm:account', id: 'acc-1', actions: { read: true } });
      expect(check(permix, schema, 'user', { id: 'u-1', accountId: 'acc-1' }, 'read')).toBe(true);
      expect(check(permix, schema, 'user', { id: 'u-1', accountId: 'other' }, 'read')).toBe(false);
      expect(check(permix, schema, 'user', { id: 'u-1', accountId: null }, 'read')).toBe(false);
    });

    it('abac-after-bridge: far (crm) record fields come from supplemental data', () => {
      const schema: RebacSchema = {
        bridges,
        permissions: {
          'db:user': { actions: { read: { rel: 'crm:account', action: 'read' } } },
          'crm:account': {
            actions: {
              read: { rule: { field: 'tier', operator: Operator.equals, value: 'gold' } },
            },
          },
        },
      };
      const record = { id: 'u-1', accountId: 'acc-1' };
      const data = { 'crm:account': [{ id: 'acc-1', tier: 'gold' }] };
      expect(check(permix, schema, 'user', record, 'read', data)).toBe(true);
      // no supplemental data → far fields absent → abac denies
      expect(check(permix, schema, 'user', record, 'read')).toBe(false);
    });
  });
});
