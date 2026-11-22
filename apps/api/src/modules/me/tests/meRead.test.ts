import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import { db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import type { meReadRoute } from '#/modules/me/routes/meRead';
import { createTestApp } from '#tests/createTestApp';
import { get, parseSuccessBody } from '#tests/utils/request';

afterEach(async () => {
  await cleanupTouchedTables(db);
});

type MeReadResponse = z.infer<typeof meReadRoute.responseSchema>;

describe('GET /me', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let mockUser: Awaited<ReturnType<typeof createUser>>['entity'];

  beforeAll(async () => {
    const { entity } = await createUser();
    mockUser = entity;

    const harness = createTestApp({
      mockUser,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
  });

  it('returns current user', async () => {
    const response = await fetch(get('/api/v1/me'));
    const { data } = await parseSuccessBody<MeReadResponse>(response);

    expect(response.status).toBe(200);
    expect(data.id).toBe(mockUser.id);
    expect(data.email).toBe(mockUser.email);
  });
});
