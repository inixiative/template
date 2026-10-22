import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type {
  Organization,
  OrganizationUser,
  Role,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const heldByAdmin = {
  'artifact.create': true,
  'billing.view': true,
  'billing.edit': true,
  'audit.read': true,
};

type InquiryBody = { id: string; status: string; updatedAt: string };

describe('handler: grantUserEntitlements', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let organization: Organization;
  let space: Space;
  let requester: User;
  let requesterMembership: OrganizationUser;
  let requesterSpaceMembership: SpaceUser;
  const members: Record<Role, { user: User; membership: OrganizationUser }> = {} as never;
  let spaceAdmin: { user: User; membership: OrganizationUser; spaceUser: SpaceUser };

  const appFor = (
    user: User,
    organizationUsers: OrganizationUser[],
    spaceUsers: SpaceUser[] = [],
  ) =>
    createTestApp({
      mockUser: user,
      mockOrganizationUsers: organizationUsers,
      mockSpaceUsers: spaceUsers,
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/inquiry', inquiryRouter),
        (app) => app.route('/api/v1/integration', integrationRouter),
      ],
    });

  const requestFromOrganization = async (entitlements: Record<string, boolean>) => {
    const response = await appFor(requester, [requesterMembership]).fetch(
      post('/api/v1/me/inquiries', {
        type: 'grantUserEntitlements',
        targetModel: 'Organization',
        targetOrganizationId: organization.id,
        status: 'sent',
        content: { purpose: 'need more', entitlements },
      }),
    );
    expect(response.status).toBe(201);
    return (await json<InquiryBody>(response)).data;
  };

  const currentVersion = async (inquiryId: string) =>
    (await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).updatedAt.toISOString();

  const approveAs = async (role: Role, inquiryId: string) =>
    appFor(members[role].user, [members[role].membership]).fetch(
      post(`/api/v1/inquiry/${inquiryId}/resolve`, {
        status: 'approved',
        expectedUpdatedAt: await currentVersion(inquiryId),
      }),
    );

  const membershipEntitlements = async () =>
    (await db.organizationUser.findUniqueOrThrow({ where: { id: requesterMembership.id } }))
      .entitlements as Record<string, boolean> | null;

  beforeAll(async () => {
    organization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
    requester = (await createUser()).entity;
    const { entity: membership, context } = await createOrganizationUser(
      { role: 'member' },
      { user: requester, organization },
    );
    requesterMembership = membership;
    requesterSpaceMembership = (await createSpaceUser({ role: 'viewer' }, { ...context, space }))
      .entity;
    for (const role of ['owner', 'admin', 'member', 'viewer'] as const) {
      const user = (await createUser()).entity;
      const { entity } = await createOrganizationUser(
        { role, entitlements: role === 'admin' ? heldByAdmin : undefined },
        { user, organization },
      );
      members[role] = { user, membership: entity };
    }
    const spaceAdminUser = (await createUser()).entity;
    const { entity: spaceAdminMembership, context: spaceAdminContext } =
      await createOrganizationUser({ role: 'viewer' }, { user: spaceAdminUser, organization });
    spaceAdmin = {
      user: spaceAdminUser,
      membership: spaceAdminMembership,
      spaceUser: (await createSpaceUser({ role: 'admin' }, { ...spaceAdminContext, space })).entity,
    };
    db = createTestApp().db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('an org user asks its organization for entitlements', () => {
    it('does not need to hold what it asks for, and is not auto-approved', async () => {
      const inquiry = await requestFromOrganization({ 'artifact.create': true });
      expect(inquiry.status).toBe('sent');
    });

    it('an org manager approves, and the membership gains the entitlements', async () => {
      const inquiry = await requestFromOrganization({ 'artifact.create': true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(200);
      expect(await membershipEntitlements()).toMatchObject({ 'artifact.create': true });
    });

    it('a manager cannot approve a key it does not hold itself; neither can the owner', async () => {
      const inquiry = await requestFromOrganization({ 'report.export': true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(403);
      expect((await approveAs('owner', inquiry.id)).status).toBe(403);
    });

    it('a viewer cannot approve', async () => {
      const inquiry = await requestFromOrganization({ 'report.export': true });
      expect((await approveAs('viewer', inquiry.id)).status).toBe(403);
    });

    it('a member cannot approve', async () => {
      const inquiry = await requestFromOrganization({ 'report.export': true });
      expect((await approveAs('member', inquiry.id)).status).toBe(403);
    });

    it('an admin cannot approve an owner-level entitlement; the owner can', async () => {
      const inquiry = await requestFromOrganization({ own: true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(403);
      expect((await approveAs('owner', inquiry.id)).status).toBe(200);
    });

    it('an admin cannot approve an admin-level entitlement either (assign: high roles need own)', async () => {
      const inquiry = await requestFromOrganization({ manage: true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(403);
    });

    it('an admin cannot approve { assign } (it would open owner-level assigns); the owner can', async () => {
      const inquiry = await requestFromOrganization({ assign: true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(403);
      expect((await approveAs('owner', inquiry.id)).status).toBe(200);
      await db.organizationUser.update({
        where: { id: requesterMembership.id },
        data: { entitlements: {} },
      });
    });

    it('revoking keeps an entitlement the member already held before the grant', async () => {
      await db.organizationUser.update({
        where: { id: requesterMembership.id },
        data: { entitlements: { 'billing.view': true } },
      });
      const inquiry = await requestFromOrganization({ 'billing.view': true, 'billing.edit': true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(200);
      const revoked = await appFor(members.admin.user, [members.admin.membership]).fetch(
        post(`/api/v1/inquiry/${inquiry.id}/revoke`, {
          expectedUpdatedAt: await currentVersion(inquiry.id),
        }),
      );
      expect(revoked.status).toBe(204);
      expect(await membershipEntitlements()).toEqual({ 'billing.view': true });
    });

    it('revoking takes the entitlements back off the membership', async () => {
      const inquiry = await requestFromOrganization({ 'audit.read': true });
      expect((await approveAs('admin', inquiry.id)).status).toBe(200);
      expect(await membershipEntitlements()).toMatchObject({ 'audit.read': true });
      const revoked = await appFor(members.admin.user, [members.admin.membership]).fetch(
        post(`/api/v1/inquiry/${inquiry.id}/revoke`, {
          expectedUpdatedAt: await currentVersion(inquiry.id),
        }),
      );
      expect(revoked.status).toBe(204);
      expect((await membershipEntitlements())?.['audit.read']).toBeUndefined();
    });

    it('cannot ask an organization it does not belong to', async () => {
      const other = (await createOrganization()).entity;
      const response = await appFor(requester, [requesterMembership]).fetch(
        post('/api/v1/me/inquiries', {
          type: 'grantUserEntitlements',
          targetModel: 'Organization',
          targetOrganizationId: other.id,
          status: 'sent',
          content: { purpose: 'x', entitlements: { read: true } },
        }),
      );
      expect(response.status).toBe(422);
    });
  });

  describe('a space user asks its space', () => {
    it('a space admin approves a member-level entitlement', async () => {
      const response = await appFor(
        requester,
        [requesterMembership],
        [requesterSpaceMembership],
      ).fetch(
        post('/api/v1/me/inquiries', {
          type: 'grantUserEntitlements',
          targetModel: 'Space',
          targetSpaceId: space.id,
          status: 'sent',
          content: { purpose: 'x', entitlements: { operate: true } },
        }),
      );
      expect(response.status).toBe(201);
      const { data } = await json<InquiryBody>(response);
      const approved = await appFor(
        spaceAdmin.user,
        [spaceAdmin.membership],
        [spaceAdmin.spaceUser],
      ).fetch(
        post(`/api/v1/inquiry/${data.id}/resolve`, {
          expectedUpdatedAt: new Date(data.updatedAt).toISOString(),
          status: 'approved',
        }),
      );
      expect(approved.status).toBe(200);
      const spaceUser = await db.spaceUser.findUniqueOrThrow({
        where: { id: requesterSpaceMembership.id },
      });
      expect(spaceUser.entitlements).toMatchObject({ operate: true });
    });
  });

  describe('auto-approval', () => {
    it('is on for the handshake: the user asks for their own grant and could approve it', async () => {
      const response = await appFor(requester, [requesterMembership]).fetch(
        post('/api/v1/me/inquiries', {
          type: 'grantUserEntitlements',
          targetModel: 'User',
          targetUserId: requester.id,
          status: 'sent',
          content: {
            purpose: 'artifactory login',
            entitlements: { 'db:user:$target': { read: true } },
          },
        }),
      );
      expect((await json<InquiryBody>(response)).data.status).toBe('approved');
    });

    it('is off for an integration request, even from the user’s own integration', async () => {
      const { entity: integration } = await createIntegration(
        { ownerModel: 'User', name: `artifactory-${randomUUID().slice(0, 6)}` },
        { user: requester },
      );
      const response = await appFor(requester, [requesterMembership]).fetch(
        post(`/api/v1/integration/${integration.id}/inquiries`, {
          type: 'grantUserEntitlements',
          targetModel: 'User',
          targetUserId: requester.id,
          status: 'sent',
          content: { purpose: 'sync', entitlements: { 'db:user:$target': { read: true } } },
        }),
      );
      expect((await json<InquiryBody>(response)).data.status).toBe('sent');
    });
  });
});
