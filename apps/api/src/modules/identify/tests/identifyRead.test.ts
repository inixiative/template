import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganization, createUser } from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { identifyRouter } from '#/modules/identify';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

type Identified = { data: { model: string; record: Record<string, unknown> } };

describe('GET /identify: who the credential is, for any actor (Aron, 2026-10-26)', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const mount: MountFn[] = [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.route('/api/v1/identify', identifyRouter);
    },
  ];

  it('a user is a User actor', async () => {
    const { entity: user } = await createUser();
    const { fetch } = createTestApp({
      mockUser: user,
      mount: [(hono) => hono.route('/api/v1/identify', identifyRouter)],
    });
    const response = await fetch(new Request('http://test/api/v1/identify'));
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as Identified;
    expect(data).toMatchObject({ model: 'User', record: { id: user.id } });
  });

  it("an organization's token is a Token actor, its row without the key hash", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: token, rawKey: key } = await createKeyedToken(
      { ownerModel: 'Organization', role: 'owner' },
      { organization },
    );
    const { app } = createTestApp({ mount });
    const response = await app.request('/api/v1/identify', {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as Identified;
    expect(data).toMatchObject({
      model: 'Token',
      record: { id: token.id, ownerModel: 'Organization', organizationId: organization.id },
    });
    expect(data.record).not.toHaveProperty('keyHash');
  });

  it('no credential is not identified', async () => {
    const { app } = createTestApp({ mount });
    expect((await app.request('/api/v1/identify')).status).toBe(401);
  });
});
