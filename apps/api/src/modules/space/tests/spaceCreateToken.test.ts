import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

describe('POST /api/v1/space/:id/tokens', () => {
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

  it('creates a space token', async () => {
    const response = await fetch(post(`/api/v1/space/${space.id}/tokens`, { name: 'New Token', role: 'member' }));
    expect(response.status).toBe(201);

    const { data } = await json<{ id: string; name: string; key: string }>(response);
    expect(data.name).toBe('New Token');
    expect(data.key).toBeDefined();
  });

  it('returns 403 for non-admin user', async () => {
    const { entity: memberOrgUser, context: memberCtx } = await createOrganizationUser({ role: 'member' }, { organization: org });
    const memberSpaceUser = await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: memberCtx.user.id,
      },
    });

    const memberHarness = createTestApp({
      mockUser: memberCtx.user,
      mockOrganizationUsers: [memberOrgUser],
      mockSpaceUsers: [memberSpaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await memberHarness.fetch(post(`/api/v1/space/${space.id}/tokens`, { name: 'Token', role: 'member' }));
    expect(response.status).toBe(403);
  });
});
