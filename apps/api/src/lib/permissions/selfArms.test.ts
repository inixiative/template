import { afterAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { inquiryRouter } from '#/modules/inquiry';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceUserRouter } from '#/modules/spaceUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';

describe('a self arm needs the action on the actor itself', () => {
  const app = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/organizationUser', organizationUserRouter);
        app.route('/api/v1/spaceUser', spaceUserRouter);
        app.route('/api/v1/token', tokenRouter);
        app.route('/api/v1/inquiry', inquiryRouter);
      },
    ],
  });

  const call = (key: string, method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const userToken = async (user: User, entitlements: Entitlements, entitlementsOnly = true) => {
    const key = randomUUID();
    const { entity } = await createToken(
      {
        ownerModel: 'User',
        role: 'owner',
        entitlements: entitlements ?? undefined,
        entitlementsOnly,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user },
    );
    return { key, token: entity };
  };

  const member = async () => {
    const user = (await createUser()).entity;
    const { entity: membership, context } = await createOrganizationUser(
      { role: 'member' },
      { user, organization: (await createOrganization()).entity },
    );
    const { entity: spaceUser } = await createSpaceUser({ role: 'member' }, context);
    return { user, membership, spaceUser, organization: context.organization };
  };

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('a narrowed { read } grant', () => {
    it('cannot leave an organization', async () => {
      const { user, membership } = await member();
      const { key } = await userToken(user, { read: true });
      expect((await call(key, 'DELETE', `/organizationUser/${membership.id}`)).status).toBe(403);
    });

    it('cannot leave a space', async () => {
      const { user, spaceUser } = await member();
      const { key } = await userToken(user, { read: true });
      expect((await call(key, 'DELETE', `/spaceUser/${spaceUser.id}`)).status).toBe(403);
    });

    it('cannot delete a token of its user, even holding token.delete', async () => {
      const { user } = await member();
      const { key } = await userToken(user, { read: true, 'token.delete': true });
      const { token: other } = await userToken(user, { read: true });
      expect((await call(key, 'DELETE', `/token/${other.id}`)).status).toBe(403);
    });

    it('cannot accept an invite', async () => {
      const { user, organization } = await member();
      const invitee = (await createUser()).entity;
      const { entity: invite } = await createInquiry({
        type: InquiryType.inviteOrganizationUser,
        status: InquiryStatus.sent,
        sourceModel: InquiryResourceModel.Organization,
        sourceOrganizationId: organization.id,
        targetModel: InquiryResourceModel.User,
        targetUserId: invitee.id,
        content: { role: 'member' },
      });
      void user;
      const { key } = await userToken(invitee, { read: true });
      expect(
        (
          await call(key, 'POST', `/inquiry/${invite.id}/resolve`, {
            status: 'approved',
            expectedUpdatedAt: invite.updatedAt.toISOString(),
          })
        ).status,
      ).toBe(403);
    });
  });

  describe('with { operate } on the user it can', () => {
    it('leave an organization', async () => {
      const { user, membership } = await member();
      const { key } = await userToken(user, { operate: true });
      expect((await call(key, 'DELETE', `/organizationUser/${membership.id}`)).status).toBe(204);
    });

    it('delete a token of its user, holding token.delete', async () => {
      const { user } = await member();
      const { key } = await userToken(user, { operate: true, 'token.delete': true });
      const { token: other } = await userToken(user, { read: true });
      expect((await call(key, 'DELETE', `/token/${other.id}`)).status).toBe(204);
    });

    it('accept an invite', async () => {
      const { organization } = await member();
      const invitee = (await createUser()).entity;
      const { entity: invite } = await createInquiry({
        type: InquiryType.inviteOrganizationUser,
        status: InquiryStatus.sent,
        sourceModel: InquiryResourceModel.Organization,
        sourceOrganizationId: organization.id,
        targetModel: InquiryResourceModel.User,
        targetUserId: invitee.id,
        content: { role: 'member' },
      });
      const { key } = await userToken(invitee, { operate: true });
      expect(
        (
          await call(key, 'POST', `/inquiry/${invite.id}/resolve`, {
            status: 'approved',
            expectedUpdatedAt: invite.updatedAt.toISOString(),
          })
        ).status,
      ).toBe(200);
    });
  });

  it('a full token leaves as before', async () => {
    const { user, membership } = await member();
    const { key } = await userToken(user, null, false);
    expect((await call(key, 'DELETE', `/organizationUser/${membership.id}`)).status).toBe(204);
  });
});
