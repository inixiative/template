import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';
import { createTestApp } from '#tests/createTestApp';
import { json, jsonError, post } from '#tests/utils/request';

type CreateOrgResponse = z.infer<typeof organizationCreateRoute.responseSchema>;

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
    const seq = getNextSeq();
    const response = await fetch(
      post('/api/v1/organization', {
        name: `Test Org ${seq}`,
        slug: `test-org-${seq}`,
      }),
    );
    const { data } = await json<CreateOrgResponse>(response);

    expect(response.status).toBe(201);
    expect(data.name).toBe(`Test Org ${seq}`);
    expect(data.slug).toBe(`test-org-${seq}`);

    const orgUser = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: data.id, userId: user.id } },
    });
    expect(orgUser).not.toBeNull();
    expect(orgUser?.role).toBe('owner');
  });

  it('rejects duplicate slug', async () => {
    const seq = getNextSeq();
    await fetch(post('/api/v1/organization', { name: 'First', slug: `dup-slug-${seq}` }));

    const response = await fetch(post('/api/v1/organization', { name: 'Second', slug: `dup-slug-${seq}` }));
    const body = await jsonError(response);

    expect(response.status).toBe(409);
    expect(body.error).toBeDefined();
  });
});
