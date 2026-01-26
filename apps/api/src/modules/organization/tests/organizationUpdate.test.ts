import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createOrganizationUser, createUser } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { organizationUpdateRoute } from '#/modules/organization/routes/organizationUpdate';
import { createTestApp } from '#tests/createTestApp';
import { patch } from '#tests/utils/request';

type UpdateOrgResponse = { data: z.infer<typeof organizationUpdateRoute.responseSchema> };

describe('PATCH /api/v1/organization/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { entity: o } = await createOrganization();
    org = o;

    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { User: user, Organization: org });
    orgUser = ou;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('updates the organization', async () => {
    const response = await fetch(patch(`/api/v1/organization/${org.id}`, { name: 'Updated Name' }));
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as UpdateOrgResponse;
    expect(data.name).toBe('Updated Name');
  });

  it('rejects duplicate slug', async () => {
    await createOrganization({ slug: 'taken-slug' });

    const response = await fetch(patch(`/api/v1/organization/${org.id}`, { slug: 'taken-slug' }));
    expect(response.status).toBe(409);
  });
});
