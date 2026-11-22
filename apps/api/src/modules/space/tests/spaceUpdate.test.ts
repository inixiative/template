import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
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
import { parseSuccessBody, patch } from '#tests/utils/request';

describe('PATCH /api/v1/space/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeEach(async () => {
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
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterEach(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('updates the space name', async () => {
    const response = await fetch(
      patch(`/api/v1/space/${space.id}`, { name: 'Updated Space Name' }),
    );
    expect(response.status).toBe(200);

    const { data } = await parseSuccessBody<Space>(response);
    expect(data.name).toBe('Updated Space Name');
  });
});
