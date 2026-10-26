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
  anchor: { resource: string; id: string };
  actions: Record<string, boolean>;
};

const entry = (resource: string, anchor: [string, string], actions: string[]): Entry => ({
  resource,
  anchor: { resource: anchor[0], id: anchor[1] },
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

const userApp = (user: User, members: OrganizationUser[]) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: members,
    mount: [
      (hono) => {
        hono.route('/api/v1/integration', integrationRouter);
        hono.route('/api/v1/me', meRouter);
      },
    ],
  });

describe('an integration holds entitlements and acts for its direct owner (Aron, 2026-10-25)', () => {
  let user: User;
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let otherSpace: Space;

  const memberOf = async (role: Role, org = organization, of = user) =>
    (await createOrganizationUser({ role }, { user: of, organization: org })).entity;

  const memberIntegration = (
    member: OrganizationUser,
    role: Role | null,
    entitlements: Entry[] | null = null,
  ) =>
    createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
      role,
      entitlements: entitlements ?? undefined,
    }).then(({ entity }) => entity);

  beforeAll(async () => {
    registerClearCacheHook();
    ({ entity: user } = await createUser());
    ({ entity: organization } = await createOrganization());
    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    ({ entity: otherSpace } = await createSpace({}, { organization }));
    await memberOf('owner', otherOrganization);
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  describe("a token of a member's integration", () => {
    it('holds what the integration holds there, capped by the member', async () => {
      const member = await memberOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'owner'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
    });

    it('holds no more than its own role', async () => {
      const member = await memberOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'owner'), 'viewer');
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it("holds no more than the integration's role", async () => {
      const member = await memberOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'viewer'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it('an integration entitled to one space reaches that space and no other', async () => {
      const member = await memberOf('owner', organization, (await createUser()).entity);
      const integration = await memberIntegration(member, null, [
        entry('db:space', ['db:space', space.id], ['read', 'operate', 'manage']),
      ]);
      const key = await tokenFor(integration, 'owner');
      expect(await holds(key, 'space', space.id, 'manage')).toBe(true);
      expect(await holds(key, 'space', otherSpace.id, 'read')).toBe(false);
      expect(await holds(key, 'organization', organization.id, 'read')).toBe(false);
    });

    it("reaches no other organization its member's user sits in", async () => {
      const key = await tokenFor(
        await memberIntegration(await memberOf('member'), 'owner'),
        'owner',
      );
      expect(await holds(key, 'organization', otherOrganization.id, 'read')).toBe(false);
    });

    it('acts as a token and does nothing only a user may do', async () => {
      const member = await memberOf('owner', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'owner'), 'owner');
      const actor = await request(key, 'GET', '/api/v1/probe/actor');
      expect(((await actor.json()) as { actor: { model: string } }).actor.model).toBe('Token');
      expect((await request(key, 'GET', '/api/v1/me/organizations')).status).not.toBe(200);
      expect(
        (await request(key, 'POST', '/api/v1/organization', { name: 'o', slug: randomUUID() }))
          .status,
      ).not.toBe(201);
    });

    it('the member demoted: the token loses it on the next request', async () => {
      const member = await memberOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'owner'), 'owner');
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
      await db.organizationUser.update({ where: { id: member.id }, data: { role: 'viewer' } });
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
    });

    it('stays inside its integration in every batch round', async () => {
      const member = await memberOf('member', organization, (await createUser()).entity);
      const key = await tokenFor(await memberIntegration(member, 'owner'), 'owner');
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
      const member = await memberOf(writerRole, organization, writer);
      const integration = await memberIntegration(member, null);
      const response = await userApp(writer, [member]).fetch(
        patch(`/api/v1/integration/${integration.id}`, { entitlements }),
      );
      const stored = await db.integration.findUniqueOrThrow({ where: { id: integration.id } });
      return { status: response.status, stored: stored.entitlements };
    };

    it('a member with role member gives its integration operate on its organization, not manage', async () => {
      const operate = [entry('db:organization', ['db:organization', organization.id], ['operate'])];
      expect(await grant('member', operate)).toEqual({ status: 200, stored: operate });
      const manage = [entry('db:organization', ['db:organization', organization.id], ['manage'])];
      expect(await grant('member', manage)).toEqual({ status: 403, stored: null });
    });

    it('an owner-role member gives manage on one space, an admin-role member cannot', async () => {
      const manageSpace = [entry('db:space', ['db:space', space.id], ['manage'])];
      expect((await grant('owner', manageSpace)).status).toBe(200);
      expect((await grant('admin', manageSpace)).status).toBe(403);
    });

    it('nobody grants from an organization they hold no member row in', async () => {
      const elsewhere = [
        entry('db:organization', ['db:organization', otherOrganization.id], ['read']),
      ];
      expect((await grant('owner', elsewhere)).status).toBe(403);
    });

    it("another member's admin sets no role on an owner's integration; its user does", async () => {
      const { entity: owner } = await createUser();
      const ownerMember = await memberOf('owner', organization, owner);
      const integration = await memberIntegration(ownerMember, null);
      const { entity: admin } = await createUser();
      const adminMember = await memberOf('admin', organization, admin);
      const raise = (by: User, member: OrganizationUser, role: Role) =>
        userApp(by, [member]).fetch(patch(`/api/v1/integration/${integration.id}`, { role }));
      expect((await raise(admin, adminMember, 'member')).status).toBe(403);
      expect((await raise(admin, adminMember, 'admin')).status).toBe(403);
      expect((await raise(admin, adminMember, 'owner')).status).toBe(403);
      expect((await raise(owner, ownerMember, 'owner')).status).toBe(200);
    });

    it("a member's integration is a narrowing of the member: set at or below the member's role", async () => {
      const { entity: writer } = await createUser();
      const member = await memberOf('member', organization, writer);
      const integration = await memberIntegration(member, null);
      const set = (role: Role) =>
        userApp(writer, [member]).fetch(patch(`/api/v1/integration/${integration.id}`, { role }));
      expect((await set('admin')).status).toBe(403);
      expect((await set('member')).status).toBe(200);
      const key = await tokenFor(
        await db.integration.findUniqueOrThrow({ where: { id: integration.id } }),
        'owner',
      );
      expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
      expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
    });

    it('entitlements must be well formed', async () => {
      const response = await grant('owner', [
        { resource: 'db:organization' },
      ] as unknown as Entry[]);
      expect(response.status).toBe(422);
    });
  });

  describe('minting a token for an integration', () => {
    it('a user who manages the integration mints one; its token, with no user, cannot', async () => {
      const { entity: writer } = await createUser();
      const member = await memberOf('member', organization, writer);
      const integration = await memberIntegration(member, 'member');
      const minted = await userApp(writer, [member]).fetch(
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
      expect(again.status).toBe(403);
    });
  });
});
