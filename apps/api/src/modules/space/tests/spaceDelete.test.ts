import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

describe('DELETE /api/v1/space/:id', () => {
  let _fetch: ReturnType<typeof createTestApp>['fetch'];
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

    ({ entity: spaceUser } = await createSpaceUser(
      { role: 'owner' },
      { user, organization: org, space, organizationUser: orgUser },
    ));

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    _fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('soft deletes the space', async () => {
    const { entity: toDelete } = await createSpace({}, { organization: org });
    const { entity: toDeleteSpaceUser } = await createSpaceUser(
      { role: 'owner' },
      { user, organization: org, space: toDelete, organizationUser: orgUser },
    );

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser, toDeleteSpaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await harness.fetch(del(`/api/v1/space/${toDelete.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.withDeleted(() => db.space.findUnique({ where: { id: toDelete.id } }));
    expect(deleted).not.toBeNull();
    expect(deleted?.deletedAt).not.toBeNull();
  });
});
