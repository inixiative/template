import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db, hydrate } from '@template/db';
import type {
  Integration,
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
  createToken,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { buildPermix } from '#/lib/permissions/buildPermix';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { integrationRouter } from '#/modules/integration';
import { findUserWithRelations } from '#/modules/user/services/find';
import { createTestApp } from '#tests/createTestApp';

type Membership =
  | { organizationUser: OrganizationUser; spaceUser?: undefined }
  | { spaceUser: SpaceUser; organizationUser?: undefined };

const stored = async (userId: string) => {
  const found = await findUserWithRelations(userId);
  if (!found) throw new Error('expected the user');
  return found;
};

const personPermix = async (user: User) =>
  buildPermix({ user: await stored(user.id), token: null, grant: null });

const reaches = async (
  permix: Awaited<ReturnType<typeof buildPermix>>,
  integration: Integration,
  action: string,
) => check(permix, rebacSchema, 'integration', await hydrate('integration', integration), action);

describe('a membership token manages what its own membership owns (Aron, 2026-10-18)', () => {
  let organization: Organization;
  let space: Space;
  let orgOwner: User;
  let orgAdmin: User;
  let member: User;
  let otherMember: User;
  let membership: OrganizationUser;
  let spaceMembership: SpaceUser;
  let memberIntegration: Integration;
  let otherMemberIntegration: Integration;
  let spaceMemberIntegration: Integration;
  let otherSpaceMemberIntegration: Integration;
  let personalIntegration: Integration;
  let organizationIntegration: Integration;

  const tokenApp = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/integration', integrationRouter);
      },
    ],
  });

  const rename = (key: string, integration: Integration) =>
    tokenApp.fetch(
      new Request(`http://test/api/v1/integration/${integration.id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: `renamed-${randomUUID().slice(0, 8)}` }),
      }),
    );

  const mintMembershipToken = async (user: User, role: Role, held: Membership) => {
    const key = randomUUID();
    await createToken(
      {
        ownerModel: held.spaceUser ? 'SpaceUser' : 'OrganizationUser',
        role,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      held.spaceUser
        ? { user, organization, space, organizationUser: membership, spaceUser: held.spaceUser }
        : { user, organization, organizationUser: held.organizationUser },
    );
    return key;
  };

  const membershipTokenPermix = async (user: User, role: Role, held: Membership) => {
    const { entity: token } = await createToken(
      {
        ownerModel: held.spaceUser ? 'SpaceUser' : 'OrganizationUser',
        role,
        keyHash: createHash('sha256').update(randomUUID()).digest('hex'),
      },
      held.spaceUser
        ? { user, organization, space, organizationUser: membership, spaceUser: held.spaceUser }
        : { user, organization, organizationUser: held.organizationUser },
    );
    const holder = await stored(user.id);
    return buildPermix({
      user: holder,
      token: {
        ...token,
        user: holder,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
      },
      grant: {
        role: token.role,
        entitlements: null,
        entitlementsOnly: false,
        integrationId: token.integrationId,
        integrationReach: token.integrationReach,
        integrationReachIds: token.integrationReachIds,
      },
    });
  };

  beforeAll(async () => {
    organization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
    const join = async (role: Role) => {
      const user = (await createUser()).entity;
      const { entity } = await createOrganizationUser({ role }, { user, organization });
      return { user, membership: entity };
    };
    ({ user: orgOwner } = await join('owner'));
    ({ user: orgAdmin } = await join('admin'));
    ({ user: member, membership } = await join('member'));
    const other = await join('member');
    otherMember = other.user;
    spaceMembership = (
      await createSpaceUser(
        { role: 'member' },
        { user: member, organization, space, organizationUser: membership },
      )
    ).entity;
    const otherSpaceMembership = (
      await createSpaceUser(
        { role: 'member' },
        { user: otherMember, organization, space, organizationUser: other.membership },
      )
    ).entity;

    memberIntegration = (
      await createIntegration(
        { ownerModel: 'OrganizationUser' },
        { user: member, organization, organizationUser: membership },
      )
    ).entity;
    otherMemberIntegration = (
      await createIntegration(
        { ownerModel: 'OrganizationUser' },
        { user: otherMember, organization, organizationUser: other.membership },
      )
    ).entity;
    spaceMemberIntegration = (
      await createIntegration(
        { ownerModel: 'SpaceUser' },
        {
          user: member,
          organization,
          space,
          organizationUser: membership,
          spaceUser: spaceMembership,
        },
      )
    ).entity;
    otherSpaceMemberIntegration = (
      await createIntegration(
        { ownerModel: 'SpaceUser' },
        {
          user: otherMember,
          organization,
          space,
          organizationUser: other.membership,
          spaceUser: otherSpaceMembership,
        },
      )
    ).entity;
    personalIntegration = (await createIntegration({ ownerModel: 'User' }, { user: member }))
      .entity;
    organizationIntegration = (
      await createIntegration({ ownerModel: 'Organization' }, { organization })
    ).entity;
  }, 30_000);

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('an OrganizationUser token manages its own org-user integration', async () => {
    const permix = await membershipTokenPermix(member, 'owner', { organizationUser: membership });
    for (const action of ['own', 'manage', 'operate', 'read'])
      expect(await reaches(permix, memberIntegration, action)).toBe(true);
    const key = await mintMembershipToken(member, 'owner', { organizationUser: membership });
    expect((await rename(key, memberIntegration)).status).toBe(200);
  });

  it('caps the membership token by its role', async () => {
    const viewer = await membershipTokenPermix(member, 'viewer', { organizationUser: membership });
    expect(await reaches(viewer, memberIntegration, 'read')).toBe(true);
    expect(await reaches(viewer, memberIntegration, 'manage')).toBe(false);
    const admin = await membershipTokenPermix(member, 'admin', { organizationUser: membership });
    expect(await reaches(admin, memberIntegration, 'manage')).toBe(true);
    expect(await reaches(admin, memberIntegration, 'own')).toBe(false);
    const viewerKey = await mintMembershipToken(member, 'viewer', { organizationUser: membership });
    expect((await rename(viewerKey, memberIntegration)).status).toBe(403);
  });

  it('keeps an OrganizationUser token off other owners', async () => {
    const permix = await membershipTokenPermix(member, 'owner', { organizationUser: membership });
    expect(await reaches(permix, otherMemberIntegration, 'read')).toBe(false);
    expect(await reaches(permix, personalIntegration, 'read')).toBe(false);
    expect(await reaches(permix, spaceMemberIntegration, 'read')).toBe(false);
    expect(await reaches(permix, organizationIntegration, 'manage')).toBe(false);
    expect(await reaches(permix, organizationIntegration, 'read')).toBe(true);
    const key = await mintMembershipToken(member, 'owner', { organizationUser: membership });
    expect((await rename(key, otherMemberIntegration)).status).toBe(403);
    expect((await rename(key, personalIntegration)).status).toBe(403);
    expect((await rename(key, organizationIntegration)).status).toBe(403);
  });

  it('gives the token no new authority over the membership row itself', async () => {
    const permix = await membershipTokenPermix(member, 'owner', { organizationUser: membership });
    for (const action of ['manage', 'own'])
      expect(check(permix, rebacSchema, 'organizationUser', membership, action)).toBe(false);
    expect(
      check(permix, rebacSchema, 'organization', { id: organization.id, role: 'owner' }, 'assign'),
    ).toBe(false);
  });

  it("keeps an org admin out of a member's integration and lets an org owner in", async () => {
    const admin = await personPermix(orgAdmin);
    expect(await reaches(admin, memberIntegration, 'manage')).toBe(false);
    expect(await reaches(admin, memberIntegration, 'read')).toBe(false);
    expect(await reaches(admin, organizationIntegration, 'manage')).toBe(true);
    const owner = await personPermix(orgOwner);
    expect(await reaches(owner, memberIntegration, 'own')).toBe(true);
    expect(await reaches(owner, spaceMemberIntegration, 'own')).toBe(true);
  });

  it('the member reaches their own integration through their person JWT', async () => {
    const person = await personPermix(member);
    expect(await reaches(person, memberIntegration, 'own')).toBe(true);
    expect(await reaches(person, spaceMemberIntegration, 'own')).toBe(true);
    expect(await reaches(person, otherMemberIntegration, 'read')).toBe(false);
  });

  it('a SpaceUser token manages its own space-user integration and nothing else', async () => {
    const permix = await membershipTokenPermix(member, 'owner', { spaceUser: spaceMembership });
    expect(await reaches(permix, spaceMemberIntegration, 'manage')).toBe(true);
    expect(await reaches(permix, otherSpaceMemberIntegration, 'read')).toBe(false);
    expect(await reaches(permix, memberIntegration, 'read')).toBe(false);
    expect(await reaches(permix, personalIntegration, 'read')).toBe(false);
    const key = await mintMembershipToken(member, 'owner', { spaceUser: spaceMembership });
    expect((await rename(key, spaceMemberIntegration)).status).toBe(200);
    expect((await rename(key, otherSpaceMemberIntegration)).status).toBe(403);
    expect((await rename(key, memberIntegration)).status).toBe(403);
  });
});
