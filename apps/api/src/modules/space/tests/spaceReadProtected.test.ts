import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/protected', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'member' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    spaceUser = await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: user.id,
      },
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('returns protected space data for authorized user', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/protected`));
    expect(response.status).toBe(200);

    const { data } = await json<Space>(response);
    expect(data.id).toBe(space.id);
  });

  it('returns 403 for user without space access', async () => {
    const { entity: otherOrgUser, context: otherCtx } = await createOrganizationUser({ role: 'member' });

    const otherHarness = createTestApp({
      mockUser: otherCtx.user,
      mockOrganizationUsers: [otherOrgUser],
      mockSpaceUsers: [],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await otherHarness.fetch(get(`/api/v1/space/${space.id}/protected`));
    expect(response.status).toBe(403);
  });
});
