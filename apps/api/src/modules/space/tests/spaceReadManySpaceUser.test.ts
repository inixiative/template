import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/spaceUsers', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    spaceUser = await db.spaceUser.create({
      data: {
        role: 'admin',
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

  it('returns space users', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/spaceUsers`));
    expect(response.status).toBe(200);

    const { data } = await json<SpaceUser[]>(response);
    expect(data.length).toBe(1);
    expect(data[0].id).toBe(spaceUser.id);
  });

  it('returns multiple space users', async () => {
    const { entity: memberOrgUser, context: memberCtx } = await createOrganizationUser({ role: 'member' }, { organization: org });
    await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: memberCtx.user.id,
      },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/spaceUsers`));
    expect(response.status).toBe(200);

    const { data } = await json<SpaceUser[]>(response);
    expect(data.length).toBe(2);
  });
});
