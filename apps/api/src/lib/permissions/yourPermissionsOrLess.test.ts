import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, unregisterDbHook } from '@template/db';
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
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { del, patch, post } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

const as = (user: User, organizationUsers: OrganizationUser[], spaceUsers: SpaceUser[] = []) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (hono) => {
        hono.route('/api/v1/integration', integrationRouter);
        hono.route('/api/v1/me', meRouter);
        hono.route('/api/v1/organization', organizationRouter);
        hono.route('/api/v1/organizationUser', organizationUserRouter);
        hono.route('/api/v1/space', spaceRouter);
        hono.route('/api/v1/token', tokenRouter);
      },
    ],
  }).fetch;

const anonymous = createTestApp({
  mount: [(hono) => hono.route('/api/v1/integration', integrationRouter)],
}).fetch;

type Permissions = { role?: Role | null; full?: boolean; entitlements?: Entry[] | null };

describe('a writer gives its permissions or less (Aron, 2026-10-25/26)', () => {
  let organization: Organization;
  let space: Space;
  let owner: { user: User; organizationUser: OrganizationUser };
  let admin: { user: User; organizationUser: OrganizationUser };

  const member = async (role: Role) => {
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role },
      { organization },
    );
    return { user: context.user, organizationUser };
  };

  const orgIntegration = (role: Role | null, entitlements?: Entry[]) =>
    createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role,
      entitlements,
    }).then(({ entity }) => entity);

  const mint = async (
    writer: { user: User; organizationUser: OrganizationUser },
    path: string,
    permissions: Permissions,
  ) => {
    const response = await as(writer.user, [writer.organizationUser])(
      post(`/api/v1/${path}/tokens`, { name: 'k', ...permissions }),
    );
    const body = (await response.json()) as { data?: { key: string } };
    return { status: response.status, key: body.data?.key };
  };

  const createOrgIntegration = (
    writer: { user: User; organizationUser: OrganizationUser },
    permissions: Permissions,
  ) =>
    as(writer.user, [writer.organizationUser])(
      post(`/api/v1/organization/${organization.id}/integrations`, {
        name: `i-${randomUUID()}`,
        ...permissions,
      }),
    );

  const update = (
    writer: { user: User; organizationUser: OrganizationUser },
    integration: Integration,
    { entitlements, ...permissions }: Permissions,
  ) =>
    as(writer.user, [writer.organizationUser])(
      entitlements
        ? patch(`/api/v1/integration/${integration.id}/entitlements`, { add: entitlements })
        : patch(`/api/v1/integration/${integration.id}`, permissions),
    );

  beforeAll(async () => {
    registerClearCacheHook();
    registerRulesHook();
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    owner = await member('owner');
    admin = await member('admin');
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  describe('minting a token', () => {
    it('an admin cannot mint an owner token on an owner integration', async () => {
      const integration = await orgIntegration('owner');
      expect((await mint(admin, `integration/${integration.id}`, { role: 'owner' })).status).toBe(
        403,
      );
    });

    it('an admin cannot mint a full token on an owner integration; an admin token manages and does not own', async () => {
      const integration = await orgIntegration('owner');
      expect((await mint(admin, `integration/${integration.id}`, { full: true })).status).toBe(403);
      const minted = await mint(admin, `integration/${integration.id}`, { role: 'admin' });
      expect(minted.status).toBe(201);
      expect(await holds(minted.key!, 'organization', organization.id, 'manage')).toBe(true);
      expect(await holds(minted.key!, 'organization', organization.id, 'own')).toBe(false);
    });

    it('an integration raised later never widens a token: the role is checked as written', async () => {
      const integration = await orgIntegration('member');
      expect((await mint(admin, `integration/${integration.id}`, { role: 'owner' })).status).toBe(
        403,
      );
      const minted = await mint(admin, `integration/${integration.id}`, { role: 'member' });
      expect(minted.status).toBe(201);
      expect((await update(owner, integration, { role: 'owner' })).status).toBe(200);
      expect(await holds(minted.key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(minted.key!, 'organization', organization.id, 'manage')).toBe(false);
    });

    it('an admin cannot name an entitlement action it does not hold', async () => {
      const integration = await orgIntegration('member');
      const ownOrganization = [
        entry('db:organization', ['db:organization', organization.id], ['own']),
      ];
      expect(
        (await mint(admin, `integration/${integration.id}`, { entitlements: ownOrganization }))
          .status,
      ).toBe(403);
    });

    it('a role token on an integration with no role is an error: the role narrows nothing (R114)', async () => {
      const integration = await orgIntegration(null, [
        entry('db:space', ['db:space', space.id], ['read', 'operate']),
      ]);
      const minted = await mint(admin, `integration/${integration.id}`, { role: 'member' });
      expect(minted.status).toBe(422);
    });

    it('an integration that goes from a role to none must keep something: entitlements, or it is a 422 (R114)', async () => {
      expect((await update(owner, await orgIntegration('viewer'), { role: null })).status).toBe(
        422,
      );
      const entitled = await orgIntegration('viewer', [
        entry('db:space', ['db:space', space.id], ['read']),
      ]);
      expect((await update(owner, entitled, { role: null })).status).toBe(200);
    });

    it('a token left with a role over a role-less integration is judged as it will be: it can be repaired (R114)', async () => {
      const integration = await orgIntegration('admin', [
        entry('db:space', ['db:space', space.id], ['read']),
      ]);
      expect((await mint(owner, `integration/${integration.id}`, { role: 'member' })).status).toBe(
        201,
      );
      expect((await update(owner, integration, { role: null })).status).toBe(200);
      const token = await db.token.findFirstOrThrow({ where: { integrationId: integration.id } });
      const repaired = await as(owner.user, [owner.organizationUser])(
        patch(`/api/v1/token/${token.id}`, { full: true, role: null }),
      );
      expect(repaired.status).toBe(200);
    });

    it('an owner mints an owner token on its own member row; lowered to admin, the token operates as admin', async () => {
      const writer = await member('owner');
      const minted = await mint(writer, `organizationUser/${writer.organizationUser.id}`, {
        role: 'owner',
      });
      expect(minted.status).toBe(201);
      expect(await holds(minted.key!, 'organization', organization.id, 'own')).toBe(true);
      const lowered = await as(owner.user, [owner.organizationUser])(
        patch(`/api/v1/organizationUser/${writer.organizationUser.id}`, { role: 'admin' }),
      );
      expect(lowered.status).toBe(200);
      expect(await holds(minted.key!, 'organization', organization.id, 'own')).toBe(false);
      expect(await holds(minted.key!, 'organization', organization.id, 'manage')).toBe(true);
    });

    it("a member mints on its own member row at any role: it holds the member's role or less (Aron, 2026-10-29)", async () => {
      const writer = await member('member');
      const path = `organizationUser/${writer.organizationUser.id}`;
      expect((await mint(writer, path, { role: 'admin' })).status).toBe(201);
      expect((await mint(writer, path, { role: 'member' })).status).toBe(201);
    });

    it('an org admin who owns a space mints an owner user token: it acts as owner where they are, admin at the org', async () => {
      const writer = await member('admin');
      const { entity: spaceUser } = await createSpaceUser(
        { role: 'owner' },
        { organization, user: writer.user, organizationUser: writer.organizationUser, space },
      );
      const fetch = as(writer.user, [writer.organizationUser], [spaceUser]);
      expect((await fetch(post('/api/v1/me/tokens', { name: 'k', role: 'owner' }))).status).toBe(
        201,
      );
      expect((await fetch(post('/api/v1/me/tokens', { name: 'k', full: true }))).status).toBe(201);
    });
  });

  describe('writing an integration, like a member', () => {
    it('an admin creates a member, viewer or admin integration, never owner', async () => {
      expect((await createOrgIntegration(admin, { role: 'owner' })).status).toBe(403);
      expect((await createOrgIntegration(admin, { role: 'admin' })).status).toBe(201);
      const created = await createOrgIntegration(admin, { role: 'member' });
      expect(created.status).toBe(201);
      expect(((await created.json()) as { data: Integration }).data.role).toBe('member');
    });

    it('an owner creates an owner integration', async () => {
      expect((await createOrgIntegration(owner, { role: 'owner' })).status).toBe(201);
    });

    it('an admin raises an integration to admin, never to owner or full', async () => {
      const integration = await orgIntegration('member');
      expect((await update(admin, integration, { role: 'owner' })).status).toBe(403);
      expect((await update(admin, integration, { role: null, full: true })).status).toBe(403);
      expect((await update(admin, integration, { role: 'admin' })).status).toBe(200);
      const stored = await db.integration.findUniqueOrThrow({ where: { id: integration.id } });
      expect(stored.role).toBe('admin');
    });

    it("its user makes their member integration full or changes its role; the organization's owner and an admin do not: the chain ends at the member (R91)", async () => {
      const ownerMember = await member('owner');
      const { entity: integration } = await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: ownerMember.user.id,
        role: 'member',
      });
      expect((await update(admin, integration, { role: null, full: true })).status).toBe(403);
      expect((await update(owner, integration, { role: null, full: true })).status).toBe(403);
      expect((await update(owner, integration, { role: 'viewer' })).status).toBe(403);
      expect((await update(ownerMember, integration, { role: null, full: true })).status).toBe(200);
    });

    it('an admin cannot lower an owner integration', async () => {
      const integration = await orgIntegration('owner');
      expect((await update(admin, integration, { role: 'member' })).status).toBe(403);
    });

    it("an organization admin does not manage a space's integration: space reaches the organization only through own", async () => {
      const { entity: integration } = await createIntegration({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: space.id,
        role: 'member',
      });
      expect(
        (await update(admin, integration, { name: `i-${randomUUID()}` } as Permissions)).status,
      ).toBe(403);
      expect(
        (await update(owner, integration, { name: `i-${randomUUID()}` } as Permissions)).status,
      ).toBe(200);
    });

    it('an organization integration is never full: it holds itself', async () => {
      expect((await createOrgIntegration(owner, { full: true })).status).toBe(403);
    });

    it('an admin cannot name an entitlement action it does not hold on an integration', async () => {
      const ownOrganization = [
        entry('db:organization', ['db:organization', organization.id], ['own']),
      ];
      expect((await createOrgIntegration(admin, { entitlements: ownOrganization })).status).toBe(
        403,
      );
      const integration = await orgIntegration('member');
      expect((await update(admin, integration, { entitlements: ownOrganization })).status).toBe(
        403,
      );
    });
  });

  describe("a member's integration is that member's (Aron, 2026-10-26)", () => {
    const memberIntegration = async (role: Role | null = 'member') => {
      const m = await member('member');
      const { entity: integration } = await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: m.user.id,
        role,
      });
      return { m, integration };
    };

    it('nobody signed in administers an organization integration', async () => {
      const integration = await orgIntegration('member');
      expect(
        (await anonymous(patch(`/api/v1/integration/${integration.id}`, { name: 'x' }))).status,
      ).toBe(403);
      expect((await anonymous(del(`/api/v1/integration/${integration.id}`))).status).toBe(403);
    });

    it("its user administers it; the organization's owner and an admin do not", async () => {
      const { m, integration } = await memberIntegration();
      const rename = (writer: { user: User; organizationUser: OrganizationUser }) =>
        update(writer, integration, { name: `i-${randomUUID()}` } as Permissions);
      expect((await rename(admin)).status).toBe(403);
      expect((await rename(owner)).status).toBe(403);
      expect((await rename(m)).status).toBe(200);
    });

    it('only its user mints on it; an organization admin or member does not', async () => {
      const { m, integration } = await memberIntegration();
      const path = `integration/${integration.id}`;
      expect((await mint(admin, path, { role: 'member' })).status).toBe(403);
      expect((await mint(await member('member'), path, { role: 'member' })).status).toBe(403);
      expect((await mint(m, path, { role: 'member' })).status).toBe(201);
    });

    it('its user mints any role on it: the chain ends at them (R91)', async () => {
      const { m, integration } = await memberIntegration();
      const path = `integration/${integration.id}`;
      expect((await mint(m, path, { role: 'admin' })).status).toBe(201);
      expect((await mint(m, path, { role: 'owner' })).status).toBe(201);
    });

    it('its user mints a full token on it: they operate its member', async () => {
      const { m, integration } = await memberIntegration();
      expect((await mint(m, `integration/${integration.id}`, { full: true })).status).toBe(201);
    });

    it('a member mints a full token on their member row: they operate it', async () => {
      const m = await member('member');
      expect(
        (await mint(m, `organizationUser/${m.organizationUser.id}`, { role: null, full: true }))
          .status,
      ).toBe(201);
    });
  });
});
