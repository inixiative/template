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
import { get, parseSuccessBody } from '#tests/utils/request';

describe('GET /api/v1/space/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeEach(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    ({ entity: spaceUser } = await createSpaceUser(
      { role: 'admin' },
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

  it('returns the space (public endpoint)', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}`));
    expect(response.status).toBe(200);

    const { data } = await parseSuccessBody<Space>(response);
    expect(data.id).toBe(space.id);
    expect(data.name).toBe(space.name);
  });
});
