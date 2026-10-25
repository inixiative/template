import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db, unregisterDbHook } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  TokenOwnerModel,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';

const { app } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.use('*', spoofMiddleware);
      hono.route('/api/v1/me', meRouter);
      hono.route('/api/v1/organization', organizationRouter);
      hono.route('/api/v1/batch', batchRouter);
      hono.get('/api/v1/probe/admin', validateSuperadmin, (c) => c.json({ ok: true }));
      hono.get('/api/v1/probe/actor', (c) => c.json(c.get('permix').getActor()));
      hono.get('/api/v1/probe/who', (c) =>
        c.json({
          person: c.get('user')?.id ?? null,
          superadmin: c.get('permix').isSuperadmin(),
        }),
      );
    },
  ],
});

const asKey = (key: string, path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  });

const mint = async (ownerModel: TokenOwnerModel, context: Record<string, unknown>) => {
  const key = randomUUID();
  await createToken(
    { ownerModel, role: 'owner', keyHash: createHash('sha256').update(key).digest('hex') },
    context,
  );
  return key;
};

describe('only a user acts directly: a JWT or a spoof (Aron, 2026-10-25)', () => {
  let person: User;
  let organization: Organization;
  let seat: OrganizationUser;

  beforeAll(async () => {
    registerDelegatedKeysHook();
    ({ entity: person } = await createUser());
    ({ entity: organization } = await createOrganization());
    ({ entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: person, organization },
    ));
  });

  afterAll(async () => {
    unregisterDbHook('falsePolymorphism:delegatedKeys');
    unregisterDbHook('falsePolymorphism:delegatedKeys:upsert');
    await cleanupTouchedTables(db);
  });

  it("a token's actor is its row, minus what the redact registry hides", async () => {
    const key = await mint('User', { user: person });
    const actor = (await (await asKey(key, '/api/v1/probe/actor')).json()) as {
      model: string;
      record: Record<string, unknown>;
    };
    expect(actor.model).toBe('Token');
    expect(actor.record.userId).toBe(person.id);
    expect(actor.record).not.toHaveProperty('keyHash');
  });

  it('a token never makes the request a user', async () => {
    const key = await mint('User', { user: person });
    const who = (await (await asKey(key, '/api/v1/probe/who')).json()) as { person: string | null };
    expect(who.person).toBeNull();
  });

  describe('/me is the user a User token belongs to, and nobody else', () => {
    it("a user's own token reads /me", async () => {
      const key = await mint('User', { user: person });
      const response = await asKey(key, '/api/v1/me');
      expect(response.status).toBe(200);
      expect(((await response.json()) as { data: { id: string } }).data.id).toBe(person.id);
    });

    it("a member's token does not", async () => {
      const key = await mint('OrganizationUser', { organizationUser: seat });
      expect((await asKey(key, '/api/v1/me')).status).toBe(401);
    });

    it("a user's integration's token does not", async () => {
      const { entity: integration } = await createIntegration({
        ownerModel: 'User',
        userId: person.id,
        role: 'owner',
      });
      const key = await mint('Integration', { integration });
      expect((await asKey(key, '/api/v1/me')).status).toBe(401);
    });
  });

  it("an organization's token reaches its organization's routes, by their own actions", async () => {
    const key = await mint('Organization', { organization });
    expect((await asKey(key, `/api/v1/organization/${organization.id}/protected`)).status).toBe(
      200,
    );
  });

  it("an integration's token cannot make its user an organization owner", async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: person.id,
      role: 'owner',
    });
    const key = await mint('Integration', { integration });
    const response = await asKey(key, '/api/v1/organization', {
      method: 'POST',
      body: JSON.stringify({ name: 'Taken', slug: randomUUID() }),
    });
    expect(response.status).toBe(401);
  });

  describe('a superadmin', () => {
    it("only a user is a superadmin: a superadmin's member token is not", async () => {
      const { entity: admin } = await createUser({ platformRole: 'superadmin' });
      const { entity: adminSeat } = await createOrganizationUser(
        { role: 'owner' },
        { user: admin, organization },
      );
      const key = await mint('OrganizationUser', { organizationUser: adminSeat });
      expect((await asKey(key, '/api/v1/probe/admin')).status).toBe(403);
      const who = (await (await asKey(key, '/api/v1/probe/who')).json()) as { superadmin: boolean };
      expect(who.superadmin).toBe(false);
    });

    it("a superadmin's token passes the superadmin gate", async () => {
      const { entity: admin } = await createUser({ platformRole: 'superadmin' });
      const key = await mint('User', { user: admin });
      expect((await asKey(key, '/api/v1/probe/admin')).status).toBe(200);
    });

    it("a superadmin's token is superadmin and spoofs into the user", async () => {
      const { entity: admin } = await createUser({ platformRole: 'superadmin' });
      const key = await mint('User', { user: admin });
      const spoofed = (await (
        await asKey(key, '/api/v1/probe/who', { headers: { 'x-spoof-user-email': person.email } })
      ).json()) as { person: string | null; superadmin: boolean };
      expect(spoofed).toEqual({ person: person.id, superadmin: false });
    });

    it('a spoof holds in every batch round', async () => {
      const { entity: admin } = await createUser({ platformRole: 'superadmin' });
      const key = await mint('User', { user: admin });
      const round = [{ method: 'GET', path: '/api/v1/probe/who' }];
      const response = await asKey(key, '/api/v1/batch/execute', {
        method: 'POST',
        headers: { 'x-spoof-user-email': person.email },
        body: JSON.stringify({ requests: [round, round, round], strategy: 'allowFailures' }),
      });
      const { data } = (await response.json()) as {
        data: { batch: { body: { person: string | null; superadmin: boolean } }[][] };
      };
      for (const [result] of data.batch)
        expect(result.body).toEqual({ person: person.id, superadmin: false });
    });
  });
});
