import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

describe('DELETE /api/v1/organizationUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    adminOrgUser = entity;
    user = context.User;
    org = context.Organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [adminOrgUser],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('deletes the organizationUser', async () => {
    const { entity: toDelete } = await createOrganizationUser({ role: 'viewer' }, { Organization: org });

    const response = await fetch(del(`/api/v1/organizationUser/${toDelete.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.organizationUser.findUnique({ where: { id: toDelete.id } });
    expect(deleted).toBeNull();
  });
});
