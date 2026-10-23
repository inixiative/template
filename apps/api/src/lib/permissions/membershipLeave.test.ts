import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { buildPermix } from '#/lib/permissions/buildPermix';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { organizationUserRouter } from '#/modules/organizationUser';
import { findUserWithRelations } from '#/modules/user/services/find';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

type Seat = { user: User; membership: OrganizationUser };

const stored = async (userId: string) => {
  const found = await findUserWithRelations(userId);
  if (!found) throw new Error('expected the user');
  return found;
};

const personPermix = async (user: User) =>
  buildPermix({ user: await stored(user.id), token: null, grant: null });

const stillThere = async (membership: OrganizationUser) =>
  (await db.organizationUser.findUnique({ where: { id: membership.id } })) !== null;

describe('an organization user evicts itself and nobody else (Aron, 2026-10-23)', () => {
  let organization: Organization;
  let otherOrganization: Organization;

  const join = async (org: Organization, role: Role, user?: User): Promise<Seat> => {
    const seatUser = user ?? (await createUser()).entity;
    const { entity } = await createOrganizationUser(
      { role },
      { user: seatUser, organization: org },
    );
    return { user: seatUser, membership: entity };
  };

  const personApp = (seat: Seat, ...more: OrganizationUser[]) =>
    createTestApp({
      mockUser: seat.user,
      mockOrganizationUsers: [seat.membership, ...more],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });

  const evictAsPerson = (seat: Seat, target: OrganizationUser, ...more: OrganizationUser[]) =>
    personApp(seat, ...more).fetch(del(`/api/v1/organizationUser/${target.id}`));

  const tokenApp = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/organizationUser', organizationUserRouter);
      },
    ],
  });

  const mintMembershipToken = async (seat: Seat, org: Organization, role: Role) => {
    const key = randomUUID();
    await createToken(
      {
        ownerModel: 'OrganizationUser',
        role,
        integrationReach: 'all',
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user: seat.user, organization: org, organizationUser: seat.membership },
    );
    return key;
  };

  const evictAsToken = (key: string, target: OrganizationUser) =>
    tokenApp.fetch(
      new Request(`http://test/api/v1/organizationUser/${target.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${key}` },
      }),
    );

  const membershipTokenPermix = async (seat: Seat, org: Organization, role: Role) => {
    const { entity: token } = await createToken(
      {
        ownerModel: 'OrganizationUser',
        role,
        integrationReach: 'all',
        keyHash: createHash('sha256').update(randomUUID()).digest('hex'),
      },
      { user: seat.user, organization: org, organizationUser: seat.membership },
    );
    const holder = await stored(seat.user.id);
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
    otherOrganization = (await createOrganization()).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('as a person', () => {
    it('a member leaves their own membership', async () => {
      const member = await join(organization, 'member');
      const permix = await personPermix(member.user);
      expect(check(permix, rebacSchema, 'organizationUser', member.membership, 'leave')).toBe(true);

      expect((await evictAsPerson(member, member.membership)).status).toBe(204);
      expect(await stillThere(member.membership)).toBe(false);
    });

    it('a member cannot evict a peer in the same organization', async () => {
      const member = await join(organization, 'member');
      const peer = await join(organization, 'member');
      const permix = await personPermix(member.user);
      expect(check(permix, rebacSchema, 'organizationUser', peer.membership, 'leave')).toBe(false);

      expect((await evictAsPerson(member, peer.membership)).status).toBe(403);
      expect(await stillThere(peer.membership)).toBe(true);
    });

    it('an admin evicts a member', async () => {
      const admin = await join(organization, 'admin');
      const member = await join(organization, 'member');
      expect((await evictAsPerson(admin, member.membership)).status).toBe(204);
      expect(await stillThere(member.membership)).toBe(false);
    });

    it('an admin cannot evict an owner, an owner evicts an admin', async () => {
      const owner = await join(organization, 'owner');
      const secondOwner = await join(organization, 'owner');
      const admin = await join(organization, 'admin');
      expect((await evictAsPerson(admin, secondOwner.membership)).status).toBe(403);
      expect(await stillThere(secondOwner.membership)).toBe(true);

      expect((await evictAsPerson(owner, admin.membership)).status).toBe(204);
      expect(await stillThere(admin.membership)).toBe(false);
    });
  });

  describe('as the token of one membership', () => {
    it('the token evicts the membership it belongs to', async () => {
      const member = await join(organization, 'member');
      const permix = await membershipTokenPermix(member, organization, 'owner');
      expect(check(permix, rebacSchema, 'organizationUser', member.membership, 'leave')).toBe(true);

      const key = await mintMembershipToken(member, organization, 'owner');
      expect((await evictAsToken(key, member.membership)).status).toBe(204);
      expect(await stillThere(member.membership)).toBe(false);
    });

    it("the token cannot evict the same user's membership in another organization", async () => {
      const member = await join(organization, 'member');
      const elsewhere = await join(otherOrganization, 'member', member.user);
      const permix = await membershipTokenPermix(member, organization, 'owner');
      expect(check(permix, rebacSchema, 'organizationUser', elsewhere.membership, 'leave')).toBe(
        false,
      );

      const key = await mintMembershipToken(member, organization, 'owner');
      expect((await evictAsToken(key, elsewhere.membership)).status).toBe(403);
      expect(await stillThere(elsewhere.membership)).toBe(true);
    });

    it('the token cannot evict a peer in its own organization', async () => {
      const member = await join(organization, 'member');
      const peer = await join(organization, 'member');
      const permix = await membershipTokenPermix(member, organization, 'owner');
      expect(check(permix, rebacSchema, 'organizationUser', peer.membership, 'leave')).toBe(false);

      const key = await mintMembershipToken(member, organization, 'owner');
      expect((await evictAsToken(key, peer.membership)).status).toBe(403);
      expect(await stillThere(peer.membership)).toBe(true);
    });
  });
});
