import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createUser } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/organization/:id/protected', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'member' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('returns protected organization data for authorized user', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}/protected`));
    expect(response.status).toBe(200);

    const { data } = await json<Organization>(response);
    expect(data.id).toBe(org.id);
  });

  it('returns 403 for user without org membership', async () => {
    const { entity: otherUser } = await createUser();

    const otherHarness = createTestApp({
      mockUser: otherUser,
      mockOrganizationUsers: [],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });

    const response = await otherHarness.fetch(get(`/api/v1/organization/${org.id}/protected`));
    expect(response.status).toBe(403);
  });
});
