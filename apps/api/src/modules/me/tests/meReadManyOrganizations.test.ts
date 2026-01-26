import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import { OrganizationRole, type User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createOrganizationUser, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { meReadManyOrganizationRoute } from '#/modules/me/routes/meReadManyOrganization';
import { createTestApp } from '#tests/createTestApp';
import { get } from '#tests/utils/request';

type ReadManyOrgsResponse = {
  data: z.infer<typeof meReadManyOrganizationRoute.responseSchema>[];
  pagination: { total: number; page: number; pageSize: number };
};

describe('GET /me/organizations', () => {
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

  it('returns empty array when user has no organizations', async () => {
    const response = await fetch(get('/api/v1/me/organizations'));
    expect(response.status).toBe(200);

    const { data, pagination } = (await response.json()) as ReadManyOrgsResponse;
    expect(data).toEqual([]);
    expect(pagination.total).toBe(0);
  });

  it('returns user organizations with membership info', async () => {
    const { entity: org } = await createOrganization();
    await createOrganizationUser(
      { role: OrganizationRole.admin },
      {
        User: user,
        Organization: org,
      },
    );

    const response = await fetch(get('/api/v1/me/organizations'));
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as ReadManyOrgsResponse;
    expect(data.length).toBeGreaterThanOrEqual(1);
    const membership = data.find((m) => m.organizationId === org.id);
    expect(membership).toBeDefined();
    expect(membership!.role).toBe('admin');
    expect(membership!.organization.name).toBe(org.name);
  });

  it('returns multiple organizations', async () => {
    const { entity: org1 } = await createOrganization({ name: 'Org One' });
    const { entity: org2 } = await createOrganization({ name: 'Org Two' });

    await createOrganizationUser(
      { role: OrganizationRole.owner },
      {
        User: user,
        Organization: org1,
      },
    );
    await createOrganizationUser(
      { role: OrganizationRole.member },
      {
        User: user,
        Organization: org2,
      },
    );

    const response = await fetch(get('/api/v1/me/organizations'));
    expect(response.status).toBe(200);

    const { data, pagination } = (await response.json()) as ReadManyOrgsResponse;
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(pagination.total).toBeGreaterThanOrEqual(2);
  });
});
