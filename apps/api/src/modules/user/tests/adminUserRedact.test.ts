import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PlatformRole, type User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createUser } from '@template/db/test';
import { adminUserRouter } from '#/modules/user';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('POST /api/admin/user/:id/redact', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;

  beforeAll(async () => {
    const { entity } = await createUser({ platformRole: PlatformRole.superadmin });
    superadmin = entity;

    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/user', adminUserRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('redacts user data', async () => {
    const { entity: targetUser } = await createUser();

    const response = await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));
    expect(response.status).toBe(204);

    const redactedUser = await db.user.findUnique({ where: { id: targetUser.id } });
    expect(redactedUser?.email).toBe(`deleted-${targetUser.id}@deleted.null`);
    expect(redactedUser?.name).toBe('[DELETED]');
    expect(redactedUser?.deletedAt).not.toBeNull();
  });

  it('deletes user tokens', async () => {
    const { entity: targetUser } = await createUser();
    await db.token.create({
      data: {
        name: 'test-token',
        keyHash: 'hash123',
        keyPrefix: 'test_',
        ownerModel: 'User',
        userId: targetUser.id,
      },
    });

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const tokens = await db.token.findMany({ where: { userId: targetUser.id } });
    expect(tokens.length).toBe(0);
  });

  it('soft deletes orgs where user is only member', async () => {
    const { entity: orgUser, context } = await createOrganizationUser();
    const org = context.organization;
    const targetUser = context.user;

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const deletedOrg = await db.organization.findUnique({ where: { id: org.id } });
    expect(deletedOrg?.deletedAt).not.toBeNull();
  });

  it('keeps org if other members exist', async () => {
    const { context } = await createOrganizationUser();
    const org = context.organization;
    const targetUser = context.user;

    // Add another member
    const { entity: otherUser } = await createUser();
    await db.organizationUser.create({
      data: { organizationId: org.id, userId: otherUser.id, role: 'member' },
    });

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const existingOrg = await db.organization.findUnique({ where: { id: org.id } });
    expect(existingOrg?.deletedAt).toBeNull();
  });
});
