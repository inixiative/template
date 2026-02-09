import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

describe('DELETE /api/v1/space/:id', () => {
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
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('soft deletes the space', async () => {
    const { entity: toDelete } = await createSpace({}, { organization: org });
    const toDeleteSpaceUser = await db.spaceUser.create({
      data: {
        role: 'owner',
        organizationId: org.id,
        spaceId: toDelete.id,
        userId: user.id,
      },
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser, toDeleteSpaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await harness.fetch(del(`/api/v1/space/${toDelete.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.space.findUnique({ where: { id: toDelete.id } });
    expect(deleted).not.toBeNull();
    expect(deleted?.deletedAt).not.toBeNull();
  });
});
