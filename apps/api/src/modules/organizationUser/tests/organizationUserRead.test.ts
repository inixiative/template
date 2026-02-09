import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { OrganizationUser, OrganizationUser as OrgUserType, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/organizationUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = entity;
    user = context.user;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns the organizationUser', async () => {
    const response = await fetch(get(`/api/v1/organizationUser/${orgUser.id}`));
    expect(response.status).toBe(200);

    const { data } = await json<OrgUserType>(response);
    expect(data.id).toBe(orgUser.id);
    expect(data.role).toBe('admin');
  });
});
