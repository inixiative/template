import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { ContactOwnerModel, ContactType, PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { adminUserRouter } from '#/modules/user';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

// Redact runs `deleteMany` on a handful of user-owned models. The
// preventHardDelete hook is the production gate — without registering it
// here, tests would silently pass against a redactUser that throws in
// prod the moment a soft-delete model is hit.
registerPreventHardDeleteHook();

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
    clearHookRegistry();
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
    const { entity: targetUser, context } = await createUser();
    await createToken({}, context);

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const tokens = await db.token.findMany({ where: { userId: targetUser.id } });
    expect(tokens.length).toBe(0);
  });

  it('soft deletes orgs where user is only member', async () => {
    const { entity: _orgUser, context } = await createOrganizationUser();
    const org = context.organization;
    const targetUser = context.user;

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const deletedOrg = await db.organization.findUnique({ where: { id: org.id } });
    expect(deletedOrg?.deletedAt).not.toBeNull();
  });

  it('redacts contacts — soft-deletes + scrubs value via registry.redact', async () => {
    const { entity: targetUser } = await createUser();
    const { entity: emailContact } = await createContact({
      ownerModel: ContactOwnerModel.User,
      userId: targetUser.id,
      type: ContactType.email,
      value: { address: 'sensitive@example.com' },
    });
    const { entity: whatsappContact } = await createContact({
      ownerModel: ContactOwnerModel.User,
      userId: targetUser.id,
      type: ContactType.whatsapp,
      value: { jid: '15559999999@s.whatsapp.net' },
    });

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const refreshed = await db.contact.findMany({
      where: { id: { in: [emailContact.id, whatsappContact.id] } },
    });
    expect(refreshed).toHaveLength(2);
    for (const c of refreshed) {
      expect(c.deletedAt).not.toBeNull();
      const serialized = JSON.stringify(c.value);
      expect(serialized).toContain(c.id);
      expect(serialized).not.toContain('sensitive@example.com');
      expect(serialized).not.toContain('15559999999');
    }
  });

  it('keeps org if other members exist', async () => {
    const { context } = await createOrganizationUser();
    const org = context.organization;
    const targetUser = context.user;

    const { entity: otherUser } = await createUser();
    await createOrganizationUser({ role: 'member' }, { user: otherUser, organization: org });

    await fetch(post(`/api/admin/user/${targetUser.id}/redact`, {}));

    const existingOrg = await db.organization.findUnique({ where: { id: org.id } });
    expect(existingOrg?.deletedAt).toBeNull();
  });
});
