import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import type { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';
import { createTestApp } from '#tests/createTestApp';
import { json, patch } from '#tests/utils/request';

type UpdateOrgUserResponse = z.infer<typeof organizationUserUpdateRoute.responseSchema>;

describe('PATCH /api/v1/organizationUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    adminOrgUser = entity;
    user = context.user;
    org = context.organization;

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

  it('updates the role', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization: org });

    const response = await fetch(patch(`/api/v1/organizationUser/${member.id}`, { role: 'viewer' }));
    const { data } = await json<UpdateOrgUserResponse>(response);

    expect(response.status).toBe(200);
    expect(data.role).toBe('viewer');
  });
});
