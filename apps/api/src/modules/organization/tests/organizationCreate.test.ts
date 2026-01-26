import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

type CreateOrgResponse = { data: z.infer<typeof organizationCreateRoute.responseSchema> };

describe('POST /api/v1/organization', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('creates an organization with creator as owner', async () => {
    const response = await fetch(
      post('/api/v1/organization', {
        name: 'Test Org',
        slug: 'test-org',
      }),
    );
    expect(response.status).toBe(201);

    const { data } = (await response.json()) as CreateOrgResponse;
    expect(data.name).toBe('Test Org');
    expect(data.slug).toBe('test-org');

    const orgUser = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: data.id, userId: user.id } },
    });
    expect(orgUser).not.toBeNull();
    expect(orgUser?.role).toBe('owner');
  });

  it('rejects duplicate slug', async () => {
    await fetch(post('/api/v1/organization', { name: 'First', slug: 'duplicate-slug' }));

    const response = await fetch(post('/api/v1/organization', { name: 'Second', slug: 'duplicate-slug' }));
    expect(response.status).toBe(409);
  });
});
