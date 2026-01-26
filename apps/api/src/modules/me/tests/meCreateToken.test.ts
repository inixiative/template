import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

type CreateTokenResponse = { data: z.infer<typeof meCreateTokenRoute.responseSchema> };

describe('POST /me/tokens', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates a user token and returns raw key', async () => {
    const response = await fetch(post('/api/v1/me/tokens', { name: 'My API Key', role: 'owner' }));
    expect(response.status).toBe(201);

    const { data } = (await response.json()) as CreateTokenResponse;
    expect(data.name).toBe('My API Key');
    expect(data.ownerModel).toBe('User');
    expect(data.userId).toBe(user.id);
    expect(data.key).toBeDefined();
    expect(data.key!.length).toBeGreaterThan(20);
    expect(data.keyPrefix).toBe(data.key!.slice(0, data.keyPrefix.length));
  });

  it('creates token with expiration', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    const response = await fetch(
      post('/api/v1/me/tokens', {
        name: 'Expiring Key',
        role: 'owner',
        expiresAt,
      }),
    );
    expect(response.status).toBe(201);

    const { data } = (await response.json()) as CreateTokenResponse;
    expect(new Date(data.expiresAt!).toISOString()).toBe(expiresAt);
  });

  it('stores token in database', async () => {
    const response = await fetch(post('/api/v1/me/tokens', { name: 'Stored Token', role: 'owner' }));
    const { data } = (await response.json()) as CreateTokenResponse;

    const dbToken = await db.token.findUnique({ where: { id: data.id } });
    expect(dbToken).not.toBeNull();
    expect(dbToken?.name).toBe('Stored Token');
    expect(dbToken?.keyHash).toBeDefined();
  });
});
