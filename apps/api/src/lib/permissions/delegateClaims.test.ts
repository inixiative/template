import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type AccessorName, db, fetchOne, hydrate, unregisterDbHook } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Role,
  Space,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
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
  from: { resource: string; id: string };
  actions: Record<string, boolean>;
};

type Claim = { role?: Role | null; full?: boolean; entitlements?: Entry[] | null };

const entry = (resource: string, from: [string, string], actions: string[]): Entry => ({
  resource,
  from: { resource: from[0], id: from[1] },
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

const personApp = (user: User, seats: OrganizationUser[]) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: seats,
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
  seats: OrganizationUser[],
  path: string,
  claim: Claim,
): Promise<Minted> => {
  const response = await personApp(user, seats).fetch(post(path, { name: 'k', ...claim }));
  if (response.status !== 201) return { status: response.status };
  const { data } = (await response.json()) as { data: { key: string; id: string } };
  return { status: 201, key: data.key, id: data.id };
};

describe('a delegate holds what it claims, and no more than whoever grants it (Aron, 2026-10-25)', () => {
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let otherSpace: Space;

  const seated = async (role: Role, org = organization) => {
    const { entity: user } = await createUser();
    const { entity: seat } = await createOrganizationUser({ role }, { user, organization: org });
    return { user, seat };
  };

  const seatIntegration = async (seat: OrganizationUser, claim: Claim) =>
    (
      await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: seat.organizationId,
        userId: seat.userId,
        role: claim.role ?? null,
        full: claim.full ?? false,
        entitlements: claim.entitlements ?? undefined,
      })
    ).entity;

  const mintOn = (integration: Integration, user: User, seats: OrganizationUser[], claim: Claim) =>
    mint(user, seats, `/api/v1/integration/${integration.id}/tokens`, claim);

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

  describe('a token holds only what it claims', () => {
    it('an integration entitled to two spaces mints a token that claims one', async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, {
        entitlements: [
          entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage']),
          entry('db:space', ['db:space', otherSpace.id], ['read', 'operate', 'manage']),
        ],
      });
      const { key } = await mintOn(integration, user, [seat], {
        entitlements: [entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage'])],
      });
      expect(await holds(key!, 'space', space.id, 'manage')).toBe(true);
      expect(await holds(key!, 'space', otherSpace.id, 'read')).toBe(false);
    });

    it('a full token holds everything its integration holds', async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, {
        entitlements: [
          entry('db:space', ['db:space', space.id], ['read']),
          entry('db:space', ['db:space', otherSpace.id], ['read']),
        ],
      });
      const { key } = await mintOn(integration, user, [seat], { full: true });
      expect(await holds(key!, 'space', space.id, 'read')).toBe(true);
      expect(await holds(key!, 'space', otherSpace.id, 'read')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'read')).toBe(false);
    });

    it('a full integration passes its seat through, capped by the seat', async () => {
      const { user, seat } = await seated('member');
      const integration = await seatIntegration(seat, { full: true });
      const { key } = await mintOn(integration, user, [seat], { full: true });
      expect(await holds(key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'manage')).toBe(false);
      expect(await holds(key!, 'organization', otherOrganization.id, 'read')).toBe(false);
    });

    it('a token that is not full claims a role, entitlements or both', async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, { role: 'owner' });
      expect((await mintOn(integration, user, [seat], {})).status).toBe(422);
      expect((await mintOn(integration, user, [seat], { entitlements: [] })).status).toBe(422);
      expect((await mintOn(integration, user, [seat], { role: 'viewer' })).status).toBe(201);
    });

    it('full takes no role and no entitlements beside it', async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, { role: 'owner' });
      expect((await mintOn(integration, user, [seat], { full: true, role: 'member' })).status).toBe(
        422,
      );
    });
  });

  describe('full only means something on a delegation chain', () => {
    it("an organization's own token cannot be full", async () => {
      const { user, seat } = await seated('owner');
      const minted = await mint(user, [seat], `/api/v1/organization/${organization.id}/tokens`, {
        full: true,
      });
      expect(minted.status).toBe(422);
    });

    it("an organization's integration cannot be full", async () => {
      const { user, seat } = await seated('owner');
      const { entity: integration } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
      });
      const response = await personApp(user, [seat]).fetch(
        patch(`/api/v1/integration/${integration.id}`, { full: true }),
      );
      expect(response.status).toBe(422);
    });
  });

  describe('a token is your permissions or less', () => {
    it('an admin mints an admin organization token, not an owner one', async () => {
      const { user, seat } = await seated('admin');
      const path = `/api/v1/organization/${organization.id}/tokens`;
      expect((await mint(user, [seat], path, { role: 'admin' })).status).toBe(201);
      expect((await mint(user, [seat], path, { role: 'owner' })).status).toBe(403);
    });

    it("an admin cannot mint an owner's token on an owner's seat integration", async () => {
      const { user: owner, seat: ownerSeat } = await seated('owner');
      const integration = await seatIntegration(ownerSeat, { role: 'owner' });
      const { user: admin, seat: adminSeat } = await seated('admin');
      expect((await mintOn(integration, admin, [adminSeat], { role: 'owner' })).status).toBe(403);
      expect((await mintOn(integration, admin, [adminSeat], { full: true })).status).toBe(403);
      expect((await mintOn(integration, owner, [ownerSeat], { role: 'owner' })).status).toBe(201);
    });

    it('a person with an owner seat and a viewer seat mints a member token', async () => {
      const { user, seat } = await seated('owner');
      const { entity: viewerSeat } = await createOrganizationUser(
        { role: 'viewer' },
        { user, organization: otherOrganization },
      );
      const minted = await mint(user, [seat, viewerSeat], '/api/v1/me/tokens', {
        role: 'member',
      });
      expect(minted.status).toBe(201);
      expect(await holds(minted.key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(minted.key!, 'organization', otherOrganization.id, 'read')).toBe(true);
      expect(await holds(minted.key!, 'organization', otherOrganization.id, 'operate')).toBe(false);
    });
  });

  describe("a person's integration: a role means what it means for the person's own token", () => {
    const personIntegration = async (user: User, claim: Claim) =>
      (
        await createIntegration({
          ownerModel: 'User',
          userId: user.id,
          role: claim.role ?? null,
          full: claim.full ?? false,
          entitlements: claim.entitlements ?? undefined,
        })
      ).entity;

    it('a member role reaches every organization the person sits in, capped by the seat', async () => {
      const { user, seat } = await seated('member');
      const integration = await personIntegration(user, { role: 'member' });
      const { key } = await mintOn(integration, user, [seat], { role: 'member' });
      expect(await holds(key!, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'manage')).toBe(false);
    });

    it("only the person's own things: no role, one entry from the person", async () => {
      const { user, seat } = await seated('owner');
      const integration = await personIntegration(user, {
        entitlements: [entry('db:user', ['db:user', user.id], ['read', 'operate'])],
      });
      const { key } = await mintOn(integration, user, [seat], { full: true });
      expect(await holds(key!, 'user', user.id, 'read')).toBe(true);
      expect(await holds(key!, 'organization', organization.id, 'read')).toBe(false);
    });
  });

  describe("an integration's token", () => {
    it("carries its integration's tenancy and is not a person", async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, { role: 'owner' });
      const { key, id } = await mintOn(integration, user, [seat], { role: 'member' });
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
      ).toBe(401);
    });

    it('its person revokes it; an admin revokes a member token but not a full one', async () => {
      const { user, seat } = await seated('owner');
      const integration = await seatIntegration(seat, { full: true });
      const member = await mintOn(integration, user, [seat], { role: 'member' });
      const full = await mintOn(integration, user, [seat], { full: true });
      const mine = await mintOn(integration, user, [seat], { role: 'viewer' });
      const { user: admin, seat: adminSeat } = await seated('admin');
      const revoke = (by: User, seats: OrganizationUser[], id: string) =>
        personApp(by, seats).fetch(del(`/api/v1/token/${id}`));
      expect((await revoke(admin, [adminSeat], member.id!)).status).toBe(204);
      expect((await revoke(admin, [adminSeat], full.id!)).status).toBe(403);
      expect((await revoke(user, [seat], mine.id!)).status).toBe(204);
      expect(await db.token.findUnique({ where: { id: full.id! } })).not.toBeNull();
    });
  });

  it('a seat token does not inherit its seat entitlements unless it claims them', async () => {
    const { entity: user } = await createUser();
    const { entity: seat } = await createOrganizationUser(
      { role: 'member', entitlements: { manage: true } },
      { user, organization },
    );
    const plain = await mint(user, [seat], `/api/v1/organizationUser/${seat.id}/tokens`, {
      role: 'member',
    });
    expect(plain.status).toBe(201);
    expect(await holds(plain.key!, 'organization', organization.id, 'manage')).toBe(false);
    const whole = await mint(user, [seat], `/api/v1/organizationUser/${seat.id}/tokens`, {
      full: true,
    });
    expect(await holds(whole.key!, 'organization', organization.id, 'manage')).toBe(true);
  });
});
