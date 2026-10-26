import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db, unregisterDbHook } from '@template/db';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { registerDelegatedKeysHook } from '#/hooks/falsePolymorphism/delegatedKeysHook';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';

type Echo = {
  integrationId: string | null;
  actorTokenId: string | null;
  actorUserId: string | null;
  actor: unknown;
};

const { app } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.use('*', auditActorMiddleware);
      hono.get('/echo', (c) => {
        const actor = auditActorContext.getScope();
        return c.json({
          integrationId: actor?.integrationId ?? null,
          actorTokenId: actor?.actorTokenId ?? null,
          actorUserId: actor?.actorUserId ?? null,
          actor: actor?.actor ?? null,
        });
      });
    },
  ],
});

const echo = async (key: string, headers: Record<string, string> = {}) =>
  (await (
    await app.request('/echo', { headers: { authorization: `Bearer ${key}`, ...headers } })
  ).json()) as Echo;

describe('an integration acts through its token, and the audit names it (Aron, 2026-10-25)', () => {
  beforeAll(() => registerDelegatedKeysHook());

  afterAll(async () => {
    unregisterDbHook('falsePolymorphism:delegatedKeys');
    unregisterDbHook('falsePolymorphism:delegatedKeys:upsert');
    await cleanupTouchedTables(db);
  });

  const mint = async (fields: Record<string, unknown>, context: Record<string, unknown>) => {
    const key = randomUUID();
    const { entity } = await createToken(
      { role: 'owner', keyHash: createHash('sha256').update(key).digest('hex'), ...fields },
      context,
    );
    return { key, token: entity };
  };

  it("an integration's token carries its integration onto the audit", async () => {
    const { entity: user } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    const { key, token } = await mint({ ownerModel: 'Integration' }, { integration });
    expect(await echo(key)).toMatchObject({
      integrationId: integration.id,
      actorTokenId: token.id,
    });
  });

  it('a header cannot name an integration', async () => {
    const { entity: user } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    const { key } = await mint({ ownerModel: 'User' }, { user });
    expect((await echo(key, { 'x-integration-id': integration.id })).integrationId).toBeNull();
  });

  it('the actor snapshot is the permission actor: the sanitized token row', async () => {
    const { entity: user } = await createUser();
    const { key, token } = await mint({ ownerModel: 'User' }, { user });
    const echoed = await echo(key);
    expect(echoed.actor).toMatchObject({ model: 'Token', record: { id: token.id } });
    expect(echoed.actor).not.toHaveProperty('record.keyHash');
    expect(echoed.actorUserId).toBe(user.id);
  });

  it("a member's token records the member's user", async () => {
    const { entity: organizationUser, context } = await createOrganizationUser({ role: 'owner' });
    const { key, token } = await mint({ ownerModel: 'OrganizationUser' }, { organizationUser });
    expect(await echo(key)).toMatchObject({
      actorTokenId: token.id,
      actorUserId: context.user.id,
    });
  });

  it("a user's snapshot names who acted and nothing personal", async () => {
    const { entity: user } = await createUser({ platformRole: 'superadmin' });
    const { app: userApp } = createTestApp({
      mockUser: user,
      mount: [
        (hono) => {
          hono.use('*', auditActorMiddleware);
          hono.get('/echo', (c) => c.json({ actor: auditActorContext.getScope()?.actor ?? null }));
        },
      ],
    });
    const { actor } = (await (await userApp.request('/echo')).json()) as { actor: unknown };
    expect(actor).toEqual({ model: 'User', record: { id: user.id, platformRole: 'superadmin' } });
  });
});
