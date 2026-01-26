import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createOrganizationUser, createUser } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { organizationReadRoute } from '#/modules/organization/routes/organizationRead';
import { createTestApp } from '#tests/createTestApp';
import { get } from '#tests/utils/request';

type ReadOrgResponse = { data: z.infer<typeof organizationReadRoute.responseSchema> };

describe('GET /api/v1/organization/:id', () => {
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

    const { entity: ou } = await createOrganizationUser({ role: 'member' }, { User: user, Organization: org });
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

  it('returns the organization', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}`));
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as ReadOrgResponse;
    expect(data.id).toBe(org.id);
    expect(data.name).toBe(org.name);
  });
});
