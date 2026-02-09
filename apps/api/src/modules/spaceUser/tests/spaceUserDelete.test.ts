import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

describe('DELETE /api/v1/spaceUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'owner' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    spaceUser = await db.spaceUser.create({
      data: {
        role: 'owner',
        organizationId: org.id,
        spaceId: space.id,
        userId: user.id,
      },
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/spaceUser', spaceUserRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('deletes the spaceUser', async () => {
    const { entity: memberOrgUser, context: memberCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const memberSpaceUser = await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: memberCtx.user.id,
      },
    });

    const response = await fetch(del(`/api/v1/spaceUser/${memberSpaceUser.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.spaceUser.findUnique({ where: { id: memberSpaceUser.id } });
    expect(deleted).toBeNull();
  });

  it('allows user to leave (delete self)', async () => {
    const { entity: viewerOrgUser, context: viewerCtx } = await createOrganizationUser(
      { role: 'viewer' },
      { organization: org },
    );
    const viewerSpaceUser = await db.spaceUser.create({
      data: {
        role: 'viewer',
        organizationId: org.id,
        spaceId: space.id,
        userId: viewerCtx.user.id,
      },
    });

    const viewerHarness = createTestApp({
      mockUser: viewerCtx.user,
      mockOrganizationUsers: [viewerOrgUser],
      mockSpaceUsers: [viewerSpaceUser],
      mount: [(app) => app.route('/api/v1/spaceUser', spaceUserRouter)],
    });

    const response = await viewerHarness.fetch(del(`/api/v1/spaceUser/${viewerSpaceUser.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.spaceUser.findUnique({ where: { id: viewerSpaceUser.id } });
    expect(deleted).toBeNull();
  });
});
