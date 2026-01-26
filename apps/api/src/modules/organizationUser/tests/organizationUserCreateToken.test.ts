import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('POST /api/v1/organizationUser/:id/token', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = entity;
    user = context.User;

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

  it('creates a token for the organizationUser', async () => {
    const response = await fetch(post(`/api/v1/organizationUser/${orgUser.id}/tokens`, { name: 'Test Token', role: 'admin' }));
    expect(response.status).toBe(201);

    const { data } = await response.json();
    expect(data.name).toBe('Test Token');
    expect(data.ownerModel).toBe('OrganizationUser');
    expect(data.key).toBeDefined();
  });
});
