import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
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
  createToken,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { batchRouter } from '#/modules/batch';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { patch, post } from '#tests/utils/request';

type Entry = {
  resource: string;
  from: { resource: string; id: string };
  actions: Record<string, boolean>;
};

const entry = (resource: string, from: [string, string], actions: string[]): Entry => ({
  resource,
  from: { resource: from[0], id: from[1] },
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});

const { app } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.route('/api/v1/batch', batchRouter);
      hono.route('/api/v1/me', meRouter);
      hono.route('/api/v1/organization', organizationRouter);
      hono.get('/api/v1/probe/actor', (c) => c.json({ actor: c.get('permix').getActor() }));
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

const request = (key: string, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const holds = async (key: string, model: AccessorName, id: string, action: string) => {
  const response = await request(key, 'POST', '/api/v1/probe/holds', { model, id, action });
  expect(response.status).toBe(200);
  return ((await response.json()) as { holds: boolean }).holds;
};

const tokenFor = async (integration: Integration, role: Role) => {
  const key = randomUUID();
  await createToken(
    {
      ownerModel: 'Integration',
      role,
      keyHash: createHash('sha256').update(key).digest('hex'),
      integrationId: integration.id,
    },
    {},
  );
  return key;
};

const personApp = (user: User, seats: OrganizationUser[]) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: seats,
    mount: [
      (hono) => {
        hono.route('/api/v1/integration', integrationRouter);
        hono.route('/api/v1/me', meRouter);
      },
    ],
  });

describe('an integration holds entitlements and acts for its direct owner (Aron, 2026-10-25)', () => {
  let person: User;
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let otherSpace: Space;

  const seatOf = async (role: Role, org = organization, user = person) =>
    (await createOrganizationUser({ role }, { user, organization: org })).entity;

  const seatIntegration = (
    seat: OrganizationUser,
    role: Role | null,
    entitlements: Entry[] | null = null,
  ) =>
    createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: seat.organizationId,
      userId: seat.userId,
      role,
      entitlements: entitlements ?? undefined,
    }).then(({ entity }) => entity);

  beforeAll(async () => {
    registerClearCacheHook();
    ({ entity: person } = await createUser());
    ({ entity: organization } = await createOrganization());
    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    ({ entity: otherSpace } = await createSpace({}, { organization }));
    await seatOf('owner', otherOrganization);
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  describe("a token of a seat's integration", () => {
    it('holds what the integration holds there, capped by the seat', async () => {
      const seat = await seatOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'owner'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
    });

    it('holds no more than its own role', async () => {
      const seat = await seatOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'owner'), 'viewer');
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it("holds no more than the integration's role", async () => {
      const seat = await seatOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'viewer'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it('an integration entitled to one space reaches that space and no other', async () => {
      const seat = await seatOf('owner', organization, (await createUser()).entity);
      const integration = await seatIntegration(seat, null, [
        entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage']),
      ]);
      const key = await tokenFor(integration, 'owner');
      expect(await holds(key, 'space', space.id, 'manage')).toBe(true);
      expect(await holds(key, 'space', otherSpace.id, 'read')).toBe(false);
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(false);
    });

    it("reaches no other organization its seat's person sits in", async () => {
      const key = await tokenFor(await seatIntegration(await seatOf('member'), 'owner'), 'owner');
      expect(await holds(key, 'organization', otherOrganization.id, 'read')).toBe(false);
    });

    it('acts as a token and does nothing only a person may do', async () => {
      const seat = await seatOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'owner'), 'owner');
      const actor = await request(key, 'GET', '/api/v1/probe/actor');
      expect(((await actor.json()) as { actor: { model: string } }).actor.model).toBe('Token');
      expect((await request(key, 'GET', '/api/v1/me/organizations')).status).not.toBe(200);
      expect(
        (await request(key, 'POST', '/api/v1/organization', { name: 'o', slug: randomUUID() }))
          .status,
      ).not.toBe(201);
    });

    it('the seat demoted: the token loses it on the next request', async () => {
      const seat = await seatOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'owner'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
      await db.organizationUser.update({ where: { id: seat.id }, data: { role: 'viewer' } });
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it('stays inside its integration in every batch round', async () => {
      const seat = await seatOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await seatIntegration(seat, 'owner'), 'owner');
      const round = [
        {
          method: 'POST',
          path: '/api/v1/probe/holds',
          body: { model: 'organization', id: organization.id, action: 'operate' },
        },
        {
          method: 'POST',
          path: '/api/v1/probe/holds',
          body: { model: 'organization', id: organization.id, action: 'manage' },
        },
        {
          method: 'POST',
          path: '/api/v1/probe/holds',
          body: { model: 'organization', id: otherOrganization.id, action: 'read' },
        },
      ];
      const response = await request(key, 'POST', '/api/v1/batch/execute', {
        requests: [round, round],
        strategy: 'allowFailures',
      });
      const { data } = (await response.json()) as {
        data: { batch: { body: { holds: boolean } }[][] };
      };
      for (const results of data.batch)
        expect(results.map((result) => result.body.holds)).toEqual([true, false, false]);
    });
  });

  describe("an organization's integration", () => {
    it('holds its role on the organization and nothing beyond it', async () => {
      const { entity: integration } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
        role: 'admin',
      });
      const key = await tokenFor(integration, 'owner');
      expect(await holds(key, 'organization', organization.id, 'manage')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'own')).toBe(false);
      expect(await holds(key, 'organization', otherOrganization.id, 'read')).toBe(false);
    });
  });

  describe('granting an integration: the writer could take every action it would hold', () => {
    const grant = async (writerRole: Role, entitlements: Entry[]) => {
      const { entity: writer } = await createUser();
      const seat = await seatOf(writerRole, organization, writer);
      const integration = await seatIntegration(seat, null);
      const response = await personApp(writer, [seat]).fetch(
        patch(`/api/v1/integration/${integration.id}`, { entitlements }),
      );
      const stored = await db.integration.findUniqueOrThrow({ where: { id: integration.id } });
      return { status: response.status, stored: stored.entitlements };
    };

    it('a member seat gives its integration operate on its organization, not manage', async () => {
      const operate = [entry('db:organization', ['db:organization', organization.id], ['operate'])];
      expect(await grant('member', operate)).toEqual({ status: 200, stored: operate });
      const manage = [entry('db:organization', ['db:organization', organization.id], ['manage'])];
      expect(await grant('member', manage)).toEqual({ status: 403, stored: null });
    });

    it('an owner seat gives manage on one space, an admin seat cannot', async () => {
      const manageSpace = [entry('db:space', ['db:space', space.id], ['manage'])];
      expect((await grant('owner', manageSpace)).status).toBe(200);
      expect((await grant('admin', manageSpace)).status).toBe(403);
    });

    it('nobody grants from an organization they hold no seat in', async () => {
      const elsewhere = [
        entry('db:organization', ['db:organization', otherOrganization.id], ['read']),
      ];
      expect((await grant('owner', elsewhere)).status).toBe(403);
    });

    it('a role is granted like its actions', async () => {
      const { entity: writer } = await createUser();
      const seat = await seatOf('member', organization, writer);
      const integration = await seatIntegration(seat, null);
      const app = personApp(writer, [seat]);
      expect(
        (await app.fetch(patch(`/api/v1/integration/${integration.id}`, { role: 'member' })))
          .status,
      ).toBe(200);
      expect(
        (await app.fetch(patch(`/api/v1/integration/${integration.id}`, { role: 'admin' }))).status,
      ).toBe(403);
    });

    it('entitlements must be well formed', async () => {
      const response = await grant('owner', [
        { resource: 'db:organization' },
      ] as unknown as Entry[]);
      expect(response.status).toBe(422);
    });
  });

  describe('minting a token for an integration', () => {
    it('a person who manages the integration mints one; its token, with no person, cannot', async () => {
      const { entity: writer } = await createUser();
      const seat = await seatOf('member', organization, writer);
      const integration = await seatIntegration(seat, 'member');
      const minted = await personApp(writer, [seat]).fetch(
        post(`/api/v1/integration/${integration.id}/tokens`, { name: 'k', role: 'member' }),
      );
      expect(minted.status).toBe(201);
      const { data } = (await minted.json()) as { data: { key: string; ownerModel: string } };
      expect(data.ownerModel).toBe('Integration');
      expect(await holds(data.key, 'organization', organization.id, 'operate')).toBe(true);

      const tokenApp = createTestApp({
        mount: [
          (hono) => {
            hono.use('*', tokenAuthMiddleware);
            hono.route('/api/v1/integration', integrationRouter);
          },
        ],
      });
      const again = await tokenApp.app.request(`/api/v1/integration/${integration.id}/tokens`, {
        method: 'POST',
        headers: { authorization: `Bearer ${data.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'k', role: 'member' }),
      });
      expect(again.status).toBe(401);
    });
  });
});
