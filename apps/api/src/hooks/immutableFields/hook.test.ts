import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createToken } from '@template/db/test';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { clearImmutableFieldsCache, setImmutableFieldsCache } from '#/hooks/immutableFields/registry';

registerImmutableFieldsHook();

/**
 * NOTE: immutableFields only strips FK fields from UPDATE operations.
 * Nested creates (create/createMany inside update) are NOT processed because:
 * 1. FKs must be set on initial creation - that's the whole point
 * 2. For nested creates via relations, Prisma auto-fills the parent FK anyway
 * 3. falsePolymorphism hook handles FK validation on creates
 */

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('immutableFields hook', () => {
  let userId: string;
  let orgId: string;
  let orgUserId: string;
  let tokenId: string;

  afterEach(() => {
    clearImmutableFieldsCache();
  });

  beforeAll(async () => {
    const { entity: orgUser, context } = await createOrganizationUser();
    const { entity: token } = await createToken({ ownerModel: 'OrganizationUser' }, context);
    userId = orgUser.userId;
    orgId = orgUser.organizationId;
    orgUserId = orgUser.id;
    tokenId = token.id;
  });

  it('strips immutable FK fields from update', async () => {
    const result = await db.organizationUser.update({
      where: { id: orgUserId },
      data: {
        userId: 'should-strip',
        organizationId: 'should-strip',
        role: 'admin',
      },
    });

    expect(result.userId).toBe(userId);
    expect(result.organizationId).toBe(orgId);
    expect(result.role).toBe('admin');
  });

  it('strips immutable FK fields from updateManyAndReturn', async () => {
    await db.organizationUser.updateManyAndReturn({
      where: { id: orgUserId },
      data: {
        userId: 'should-strip',
        role: 'viewer',
      },
    });

    const result = await db.organizationUser.findUnique({ where: { id: orgUserId } });
    expect(result?.userId).toBe(userId);
    expect(result?.role).toBe('viewer');
  });

  it('strips immutable FK fields from upsert update path', async () => {
    const result = await db.organizationUser.upsert({
      where: { id: orgUserId },
      create: { userId, organizationId: orgId, role: 'member' },
      update: { userId: 'should-strip', role: 'member' },
    });

    expect(result.userId).toBe(userId);
    expect(result.role).toBe('member');
  });

  it('strips immutable FK fields 3 levels deep (User -> OrganizationUser -> Token)', async () => {
    const result = await db.user.update({
      where: { id: userId },
      data: {
        name: 'Updated Name',
        organizationUsers: {
          update: {
            where: { id: orgUserId },
            data: {
              userId: 'should-strip-level-2',
              organizationId: 'should-strip-level-2',
              role: 'admin',
              tokens: {
                update: {
                  where: { id: tokenId },
                  data: {
                    userId: 'should-strip-level-3',
                    organizationId: 'should-strip-level-3',
                    name: 'Updated Token',
                  },
                },
              },
            },
          },
        },
      },
      include: {
        organizationUsers: {
          include: { tokens: true },
        },
      },
    });

    expect(result.name).toBe('Updated Name');

    const orgUser = result.organizationUsers[0];
    expect(orgUser.userId).toBe(userId);
    expect(orgUser.organizationId).toBe(orgId);
    expect(orgUser.role).toBe('admin');

    const token = orgUser.tokens[0];
    expect(token.userId).toBe(userId);
    expect(token.organizationId).toBe(orgId);
    expect(token.name).toBe('Updated Token');
  });

  describe('overrides', () => {
    it('respects cache override - allows updating when field removed from cache', async () => {
      const { entity: testOrgUser } = await createOrganizationUser();
      const { entity: targetOrg } = await createOrganizationUser();

      setImmutableFieldsCache('OrganizationUser', ['userId']);

      const result = await db.organizationUser.update({
        where: { id: testOrgUser.id },
        data: { organizationId: targetOrg.organizationId },
      });

      expect(result.organizationId).toBe(targetOrg.organizationId);
    });

    it('respects cache override - strips additional fields added to cache', async () => {
      const { entity: testOrgUser } = await createOrganizationUser({ role: 'member' });

      setImmutableFieldsCache('OrganizationUser', ['userId', 'organizationId', 'role']);

      const result = await db.organizationUser.update({
        where: { id: testOrgUser.id },
        data: { role: 'owner' },
      });

      expect(result.role).toBe('member');
    });

    it('can lock nested JSON paths via cache', async () => {
      const initialEntitlements = { canInvite: true, maxProjects: 5 };
      const { entity: testOrgUser } = await createOrganizationUser({ entitlements: initialEntitlements });

      // Lock only the canInvite path, not the whole entitlements object
      setImmutableFieldsCache('OrganizationUser', ['userId', 'organizationId', 'entitlements.canInvite']);

      const result = await db.organizationUser.update({
        where: { id: testOrgUser.id },
        data: { entitlements: { canInvite: false, maxProjects: 100 } },
      });

      // canInvite should be stripped, maxProjects should update
      expect(result.entitlements).toEqual({ maxProjects: 100 });
    });
  });
});
