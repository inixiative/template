import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type AccessorName, db, fetchOne, hydrate, unregisterDbHook } from '@template/db';
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
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { del, patch, post } from '#tests/utils/request';

type Entry = {
  resource: string;
  anchor: { resource: string; id: string };
  actions: Record<string, boolean>;
};

type Permissions = { role?: Role | null; full?: boolean; entitlements?: Entry[] | null };

const entry = (resource: string, anchor: [string, string], actions: string[]): Entry => ({
  resource,
  anchor: { resource: anchor[0], id: anchor[1] },
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});

const { app: tokenApp } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.route('/api/v1/me', meRouter);
      hono.route('/api/v1/organization', organizationRouter);
      hono.route('/api/v1/token', tokenRouter);
      hono.post('/api/v1/probe/holds', async (c) => {
        const { model, id, action } = (await c.req.json()) as {
          model: AccessorName;
          id: string;
          action: string;
        };
        const row = await fetchOne<{ id: string }>(model, id);
        if (!row) return c.json({ holds: false });
        const record = await hydrate(model, row);
        return c.json({ holds: check(c.get('permix'), rebacSchema, model, record, action) });
      });
    },
  ],
});

const asToken = (key: string, method: string, path: string, body?: unknown) =>
  tokenApp.request(path, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const holds = async (key: string, model: AccessorName, id: string, action: string) => {
  const response = await asToken(key, 'POST', '/api/v1/probe/holds', { model, id, action });
  expect(response.status).toBe(200);
  return ((await response.json()) as { holds: boolean }).holds;
};

const userApp = (user: User, organizationUsers: OrganizationUser[], spaceUsers: SpaceUser[] = []) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (hono) => {
        hono.route('/api/v1/integration', integrationRouter);
        hono.route('/api/v1/organization', organizationRouter);
        hono.route('/api/v1/organizationUser', organizationUserRouter);
        hono.route('/api/v1/me', meRouter);
        hono.route('/api/v1/token', tokenRouter);
      },
    ],
  });

type Minted = { status: number; key?: string; id?: string };

const mint = async (
  user: User,
  organizationUsers: OrganizationUser[],
  path: string,
  permissions: Permissions,
): Promise<Minted> => {
  const response = await userApp(user, organizationUsers).fetch(
    post(path, { name: 'k', ...permissions }),
  );
  if (response.status !== 201) return { status: response.status };
  const { data } = (await response.json()) as { data: { key: string; id: string } };
  return { status: 201, key: data.key, id: data.id };
};

describe('a delegate holds its permissions, and no more than whoever grants it (Aron, 2026-10-25)', () => {
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let otherSpace: Space;

  const asMember = async (role: Role, org = organization) => {
    const { entity: user } = await createUser();
    const { entity: organizationUser } = await createOrganizationUser(
      { role },
      { user, organization: org },
    );
    return { user, organizationUser };
  };

  const memberIntegration = async (organizationUser: OrganizationUser, permissions: Permissions) =>
    (
      await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organizationUser.organizationId,
        userId: organizationUser.userId,
        role: permissions.role ?? null,
        full: permissions.full ?? false,
        entitlements: permissions.entitlements ?? undefined,
      })
    ).entity;

  const mintOn = (
    integration: Integration,
    user: User,
    organizationUsers: OrganizationUser[],
    permissions: Permissions,
  ) => mint(user, organizationUsers, `/api/v1/integration/${integration.id}/tokens`, permissions);

  beforeAll(async () => {
    registerClearCacheHook();
    registerDelegatedKeysHook();
    registerRulesHook();
    ({ entity: organization } = await createOrganization());
    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    ({ entity: otherSpace } = await createSpace({}, { organization }));
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    unregisterDbHook('falsePolymorphism:delegatedKeys');
    await cleanupTouchedTables(db);
  });

  describe('a token holds only its permissions', () => {
    it('an integration entitled to two spaces mints a token entitled to one', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, {
        entitlements: [
          entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage']),
          entry('db:space', ['db:space', otherSpace.id], ['read', 'operate', 'manage']),
        ],
      });
      const { key } = await mintOn(integration, user, [organizationUser], {
        entitlements: [entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage'])],
      });
      expect(await holds(key!, 'space', space.id, 'manage')).toBe(true);
      expect(await holds(key!, 'space', otherSpace.id, 'read')).toBe(false);
    });

    it('a full token holds everything its integration holds', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, {
        entitlements: [
          entry('db:space', ['db:space', space.id], ['read']),
          entry('db:space', ['db:space', otherSpace.id], ['read']),
        ],
      });
      const { key } = await mintOn(integration, user, [organizationUser], { full: true });
      expect(await holds(key!, 'space', space.id, 'read')).toBe(true);
      expect(await holds(key!, 'space', otherSpace.id, 'read')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'read')).toBe(false);
    });

    it('a full integration passes its member through, capped by the member', async () => {
      const { user, organizationUser } = await asMember('member');
      const integration = await memberIntegration(organizationUser, { full: true });
      const { key } = await mintOn(integration, user, [organizationUser], { full: true });
      expect(await holds(key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'manage')).toBe(false);
      expect(await holds(key!, 'organization', otherOrganization.id, 'read')).toBe(false);
    });

    it('a token that is not full has a role, entitlements or both', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, { role: 'owner' });
      expect((await mintOn(integration, user, [organizationUser], {})).status).toBe(422);
      expect(
        (await mintOn(integration, user, [organizationUser], { entitlements: [] })).status,
      ).toBe(422);
      expect((await mintOn(integration, user, [organizationUser], { role: 'viewer' })).status).toBe(
        201,
      );
    });

    it('an entitlement from a record that does not exist is malformed, not forbidden', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, { role: 'owner' });
      const nowhere = entry(
        'db:space',
        ['db:space', '01a17393-0000-7000-8000-000000000000'],
        ['read'],
      );
      expect(
        (await mintOn(integration, user, [organizationUser], { entitlements: [nowhere] })).status,
      ).toBe(422);
    });

    it('full takes no role and no entitlements beside it', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, { role: 'owner' });
      expect(
        (await mintOn(integration, user, [organizationUser], { full: true, role: 'member' }))
          .status,
      ).toBe(422);
    });
  });

  describe('full only means something on a delegation chain', () => {
    it("an organization's own token cannot be full", async () => {
      const { user, organizationUser } = await asMember('owner');
      const minted = await mint(
        user,
        [organizationUser],
        `/api/v1/organization/${organization.id}/tokens`,
        {
          full: true,
        },
      );
      expect(minted.status).toBe(422);
    });

    it("an organization's integration cannot be full", async () => {
      const { user, organizationUser } = await asMember('owner');
      const { entity: integration } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });
      const response = await userApp(user, [organizationUser]).fetch(
        patch(`/api/v1/integration/${integration.id}`, { full: true }),
      );
      expect(response.status).toBe(422);
    });
  });

  describe('a token is your permissions or less', () => {
    it('an admin mints an admin organization token, not an owner one', async () => {
      const { user, organizationUser } = await asMember('admin');
      const path = `/api/v1/organization/${organization.id}/tokens`;
      expect((await mint(user, [organizationUser], path, { role: 'admin' })).status).toBe(201);
      expect((await mint(user, [organizationUser], path, { role: 'owner' })).status).toBe(403);
    });

    it("an admin cannot mint an owner's token on an owner-role member's integration", async () => {
      const { user: owner, organizationUser: ownerMember } = await asMember('owner');
      const integration = await memberIntegration(ownerMember, { role: 'owner' });
      const { user: admin, organizationUser: adminMember } = await asMember('admin');
      expect((await mintOn(integration, admin, [adminMember], { role: 'owner' })).status).toBe(403);
      expect((await mintOn(integration, admin, [adminMember], { full: true })).status).toBe(403);
      expect((await mintOn(integration, owner, [ownerMember], { role: 'owner' })).status).toBe(201);
    });

    it('a user with an owner-role member and a viewer-role member mints a member token', async () => {
      const { user, organizationUser } = await asMember('owner');
      const { entity: viewerMember } = await createOrganizationUser(
        { role: 'viewer' },
        { user, organization: otherOrganization },
      );
      const minted = await mint(user, [organizationUser, viewerMember], '/api/v1/me/tokens', {
        role: 'member',
      });
      expect(minted.status).toBe(201);
      expect(await holds(minted.key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(minted.key!, 'organization', otherOrganization.id, 'read')).toBe(true);
      expect(await holds(minted.key!, 'organization', otherOrganization.id, 'operate')).toBe(false);
    });
  });

  describe("a user's integration: a role means what it means for the user's own token", () => {
    const userIntegration = async (user: User, permissions: Permissions) =>
      (
        await createIntegration({
          ownerModel: 'User',
          userId: user.id,
          role: permissions.role ?? null,
          full: permissions.full ?? false,
          entitlements: permissions.entitlements ?? undefined,
        })
      ).entity;

    it('a member role reaches every organization the user sits in, capped by the member', async () => {
      const { user, organizationUser } = await asMember('member');
      const integration = await userIntegration(user, { role: 'member' });
      const { key } = await mintOn(integration, user, [organizationUser], { role: 'member' });
      expect(await holds(key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'manage')).toBe(false);
    });

    it("full all the way down reaches each of the user's organizations at its member", async () => {
      const { user, organizationUser } = await asMember('owner');
      const { entity: viewerMember } = await createOrganizationUser(
        { role: 'viewer' },
        { user, organization: otherOrganization },
      );
      const integration = await userIntegration(user, { full: true });
      const { key } = await mintOn(integration, user, [organizationUser, viewerMember], {
        full: true,
      });
      expect(await holds(key!, 'organization', organization.id, 'own')).toBe(true);
      expect(await holds(key!, 'organization', otherOrganization.id, 'read')).toBe(true);
      expect(await holds(key!, 'organization', otherOrganization.id, 'operate')).toBe(false);
    });

    it("only the user's own things: no role, one entry from the user", async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await userIntegration(user, {
        entitlements: [entry('db:user', ['db:user', user.id], ['read', 'operate'])],
      });
      const { key } = await mintOn(integration, user, [organizationUser], { full: true });
      expect(await holds(key!, 'user', user.id, 'read')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'read')).toBe(false);
    });
  });

  describe("an integration's token", () => {
    it("carries its integration's tenancy, is not a user, and acts within its permissions", async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, { role: 'owner' });
      const { key, id } = await mintOn(integration, user, [organizationUser], { role: 'member' });
      const stored = await db.token.findUniqueOrThrow({ where: { id: id! } });
      expect(stored).toMatchObject({
        ownerModel: 'Integration',
        integrationId: integration.id,
        organizationId: organization.id,
        userId: user.id,
        spaceId: null,
      });
      expect((await asToken(key!, 'GET', '/api/v1/me')).status).toBe(401);
      expect(
        (await asToken(key!, 'GET', `/api/v1/organization/${organization.id}/protected`)).status,
      ).toBe(200);
    });

    it('its user revokes it; an admin up the chain revokes any token on it, even a full one; another member does not', async () => {
      const { user, organizationUser } = await asMember('owner');
      const integration = await memberIntegration(organizationUser, { full: true });
      const member = await mintOn(integration, user, [organizationUser], { role: 'member' });
      const full = await mintOn(integration, user, [organizationUser], { full: true });
      const mine = await mintOn(integration, user, [organizationUser], { role: 'viewer' });
      const { user: admin, organizationUser: adminMember } = await asMember('admin');
      const revoke = (by: User, organizationUsers: OrganizationUser[], id: string) =>
        userApp(by, organizationUsers).fetch(del(`/api/v1/token/${id}`));
      const { user: other, organizationUser: otherMember } = await asMember('member');
      expect((await revoke(other, [otherMember], member.id!)).status).toBe(403);
      expect((await revoke(admin, [adminMember], member.id!)).status).toBe(204);
      expect((await revoke(admin, [adminMember], full.id!)).status).toBe(204);
      expect((await revoke(user, [organizationUser], mine.id!)).status).toBe(204);
    });
  });

  it('a member token does not inherit its member entitlements unless it is full; a full token on a member row takes own, a full user token is the user', async () => {
    const { entity: user } = await createUser();
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'member', entitlements: { manage: true } },
      { user, organization },
    );
    const plain = await mint(
      user,
      [organizationUser],
      `/api/v1/organizationUser/${organizationUser.id}/tokens`,
      {
        role: 'member',
      },
    );
    expect(plain.status).toBe(201);
    expect(await holds(plain.key!, 'organization', organization.id, 'manage')).toBe(false);
    const onRow = await mint(
      user,
      [organizationUser],
      `/api/v1/organizationUser/${organizationUser.id}/tokens`,
      {
        full: true,
      },
    );
    expect(onRow.status).toBe(403);
    const whole = await mint(user, [organizationUser], '/api/v1/me/tokens', { full: true });
    expect(whole.status).toBe(201);
    expect(await holds(whole.key!, 'organization', organization.id, 'manage')).toBe(true);
  });

  describe('setting full is own on the direct owner, for tokens and integrations alike (Aron, 2026-10-26)', () => {
    type Mint = {
      name: string;
      memberRole: Role;
      integration: Permissions;
      token: Permissions;
      status: number;
      holds?: string;
      lacks?: string;
    };

    const mints: Mint[] = [
      {
        name: 'full token, full integration, owner member',
        memberRole: 'owner',
        integration: { full: true },
        token: { full: true },
        status: 201,
        holds: 'own',
      },
      {
        name: 'full token, full integration, member member',
        memberRole: 'member',
        integration: { full: true },
        token: { full: true },
        status: 201,
        holds: 'operate',
        lacks: 'manage',
      },
      {
        name: 'full token, viewer integration',
        memberRole: 'member',
        integration: { role: 'viewer' },
        token: { full: true },
        status: 201,
        holds: 'read',
        lacks: 'operate',
      },
      {
        name: 'admin token, full integration, admin member',
        memberRole: 'admin',
        integration: { full: true },
        token: { role: 'admin' },
        status: 201,
        holds: 'manage',
        lacks: 'own',
      },
      {
        name: 'owner token, full integration, admin member',
        memberRole: 'admin',
        integration: { full: true },
        token: { role: 'owner' },
        status: 403,
      },
      {
        name: 'admin token, full integration, member member',
        memberRole: 'member',
        integration: { full: true },
        token: { role: 'admin' },
        status: 403,
      },
      {
        name: 'admin token, viewer integration, owner member',
        memberRole: 'owner',
        integration: { role: 'viewer' },
        token: { role: 'admin' },
        status: 201,
        holds: 'read',
        lacks: 'operate',
      },
    ];

    for (const row of mints)
      it(`its user mints a token on their member's integration: ${row.name}`, async () => {
        const { user, organizationUser } = await asMember(row.memberRole);
        const integration = await memberIntegration(organizationUser, row.integration);
        const minted = await mintOn(integration, user, [organizationUser], row.token);
        expect(minted.status).toBe(row.status);
        if (row.holds)
          expect(await holds(minted.key!, 'organization', organization.id, row.holds)).toBe(true);
        if (row.lacks)
          expect(await holds(minted.key!, 'organization', organization.id, row.lacks)).toBe(false);
      });

    it("an owner of the organization cannot mint a full token on another member's full integration", async () => {
      const { organizationUser } = await asMember('member');
      const integration = await memberIntegration(organizationUser, { full: true });
      const { user: owner, organizationUser: ownerMember } = await asMember('owner');
      expect((await mintOn(integration, owner, [ownerMember], { full: true })).status).toBe(403);
    });

    it("a full token on an organization's integration: an owner mints it, an admin does not", async () => {
      const { entity: integration } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
        role: 'admin',
      });
      const { user: admin, organizationUser: adminMember } = await asMember('admin');
      expect((await mintOn(integration, admin, [adminMember], { full: true })).status).toBe(403);
      expect((await mintOn(integration, admin, [adminMember], { role: 'admin' })).status).toBe(201);
      const { user: owner, organizationUser: ownerMember } = await asMember('owner');
      const minted = await mintOn(integration, owner, [ownerMember], { full: true });
      expect(minted.status).toBe(201);
      expect(await holds(minted.key!, 'organization', organization.id, 'manage')).toBe(true);
      expect(await holds(minted.key!, 'organization', organization.id, 'own')).toBe(false);
    });

    type Write = {
      name: string;
      memberRole: Role;
      before: Permissions;
      after: Permissions;
      status: number;
    };

    const writes: Write[] = [
      {
        name: 'an owner member makes it full',
        memberRole: 'owner',
        before: { role: 'viewer' },
        after: { full: true, role: null },
        status: 200,
      },
      {
        name: 'an admin member cannot make it full',
        memberRole: 'admin',
        before: { role: 'viewer' },
        after: { full: true, role: null },
        status: 403,
      },
      {
        name: 'an owner member takes full away',
        memberRole: 'owner',
        before: { full: true },
        after: { full: false, role: 'member' },
        status: 200,
      },
      {
        name: 'an admin member cannot take full away',
        memberRole: 'admin',
        before: { full: true },
        after: { full: false, role: 'member' },
        status: 403,
      },
      {
        name: 'a member member cannot make it full',
        memberRole: 'member',
        before: { role: 'viewer' },
        after: { full: true, role: null },
        status: 403,
      },
    ];

    for (const row of writes)
      it(`its user writes their member's integration: ${row.name}`, async () => {
        const { user, organizationUser } = await asMember(row.memberRole);
        const integration = await memberIntegration(organizationUser, row.before);
        const response = await userApp(user, [organizationUser]).fetch(
          patch(`/api/v1/integration/${integration.id}`, row.after),
        );
        expect(response.status).toBe(row.status);
      });

    it("its user makes their own user's integration full", async () => {
      const { user, organizationUser } = await asMember('member');
      const { entity: integration } = await createIntegration({
        ownerModel: 'User',
        userId: user.id,
        role: 'viewer',
      });
      const response = await userApp(user, [organizationUser]).fetch(
        patch(`/api/v1/integration/${integration.id}`, { full: true, role: null }),
      );
      expect(response.status).toBe(200);
    });

    for (const [spaceRole, status] of [
      ['owner', 200],
      ['admin', 403],
    ] as const)
      it(`its user writes their space member's integration: a space ${spaceRole} ${status === 200 ? 'makes' : 'cannot make'} it full`, async () => {
        const { user, organizationUser } = await asMember('member');
        const { entity: spaceUser } = await createSpaceUser(
          { role: spaceRole },
          { user, organization, organizationUser, space },
        );
        const { entity: integration } = await createIntegration({
          ownerModel: 'SpaceUser',
          organizationId: organization.id,
          spaceId: space.id,
          userId: user.id,
          role: 'viewer',
        });
        const response = await userApp(user, [organizationUser], [spaceUser]).fetch(
          patch(`/api/v1/integration/${integration.id}`, { full: true, role: null }),
        );
        expect(response.status).toBe(status);
      });

    it('a user creates a full integration of their own', async () => {
      const { user, organizationUser } = await asMember('member');
      const response = await userApp(user, [organizationUser]).fetch(
        post('/api/v1/me/integrations', { name: 'i', full: true }),
      );
      expect(response.status).toBe(201);
    });
  });

  describe("a member's integration is created on the member row (Aron, 2026-10-26)", () => {
    const create = (
      user: User,
      organizationUsers: OrganizationUser[],
      row: OrganizationUser,
      body: object,
    ) =>
      userApp(user, organizationUsers).fetch(
        post(`/api/v1/organizationUser/${row.id}/integrations`, { name: 'i', ...body }),
      );

    it('its user creates one at or below their role, owned by the member row', async () => {
      const { user, organizationUser } = await asMember('member');
      const response = await create(user, [organizationUser], organizationUser, { role: 'member' });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: Integration };
      expect(data).toMatchObject({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: user.id,
      });
    });

    it('its user cannot give it a role above their own', async () => {
      const { user, organizationUser } = await asMember('member');
      expect(
        (await create(user, [organizationUser], organizationUser, { role: 'admin' })).status,
      ).toBe(403);
    });

    it("an admin up the chain deletes a member's integration; another member does not", async () => {
      const { organizationUser } = await asMember('member');
      const integration = await memberIntegration(organizationUser, { role: 'viewer' });
      const remove = (user: User, organizationUsers: OrganizationUser[]) =>
        userApp(user, organizationUsers).fetch(del(`/api/v1/integration/${integration.id}`));
      const { user: other, organizationUser: otherMember } = await asMember('member');
      expect((await remove(other, [otherMember])).status).toBe(403);
      const { user: admin, organizationUser: adminMember } = await asMember('admin');
      expect((await remove(admin, [adminMember])).status).toBe(204);
    });

    it("an owner of the organization cannot create one on another member's row", async () => {
      const { organizationUser } = await asMember('member');
      const { user: owner, organizationUser: ownerMember } = await asMember('owner');
      expect(
        (await create(owner, [ownerMember], organizationUser, { role: 'viewer' })).status,
      ).toBe(403);
    });
  });
});
