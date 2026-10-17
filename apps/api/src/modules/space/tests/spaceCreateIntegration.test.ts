import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

describe('POST /api/v1/space/:id/integrations', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOu: OrganizationUser;
  let space: Space;
  let adminSu: SpaceUser;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser(
      { role: 'owner' },
      { user: admin, organization: org },
    );
    adminOu = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    adminSu = su;

    const harness = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminOu],
      mockSpaceUsers: [adminSu],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("creates a space-owned integration carrying the space's organizationId", async () => {
    const response = await fetch(
      post(`/api/v1/space/${space.id}/integrations`, { name: `Space Integration ${getNextSeq()}` }),
    );
    const { data } = await json<Integration>(response);
    expect(response.status).toBe(201);
    expect(data.ownerModel).toBe('Space');
    expect(data.spaceId).toBe(space.id);
    expect(data.organizationId).toBe(org.id);
  });
});
