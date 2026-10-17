import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { json, patch } from '#tests/utils/request';

describe('PATCH /api/v1/spaceUser/:id', () => {
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

  it('updates the role', async () => {
    const { entity: _memberOrgUser, context: memberCtx } = await createOrganizationUser(
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

    const response = await fetch(
      patch(`/api/v1/spaceUser/${memberSpaceUser.id}`, { role: 'viewer' }),
    );
    expect(response.status).toBe(200);

    const { data } = await json<SpaceUser>(response);
    expect(data.role).toBe('viewer');
  });

  it('a space admin holding { assign } still cannot make someone a space owner', async () => {
    const { entity: adminOrgUser, context: adminCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const adminSpaceUser = await db.spaceUser.create({
      data: {
        role: 'admin',
        entitlements: { assign: true },
        organizationId: org.id,
        spaceId: space.id,
        userId: adminCtx.user.id,
      },
    });
    const { context: memberCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const member = await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: memberCtx.user.id,
      },
    });
    const adminFetch = createTestApp({
      mockUser: adminCtx.user,
      mockOrganizationUsers: [adminOrgUser],
      mockSpaceUsers: [adminSpaceUser],
      mount: [(app) => app.route('/api/v1/spaceUser', spaceUserRouter)],
    }).fetch;
    const response = await adminFetch(patch(`/api/v1/spaceUser/${member.id}`, { role: 'owner' }));
    expect(response.status).toBe(403);
  });
});
