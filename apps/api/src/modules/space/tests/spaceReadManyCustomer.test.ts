import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { CustomerRef, Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace, createUser } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/customers', () => {
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

  it('returns empty array when no customers', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/customers`));
    expect(response.status).toBe(200);

    const { data } = await json<CustomerRef[]>(response);
    expect(data.length).toBe(0);
  });

  it('returns user customers', async () => {
    const { entity: customerUser } = await createUser();
    await db.customerRef.create({
      data: {
        customerModel: 'User',
        customerUserId: customerUser.id,
        providerModel: 'Space',
        providerSpaceId: space.id,
      },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/customers`));
    expect(response.status).toBe(200);

    const { data } = await json<CustomerRef[]>(response);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((c) => c.customerUserId === customerUser.id)).toBe(true);
  });

  it('returns organization customers', async () => {
    const { entity: customerOrg } = await createOrganizationUser({ role: 'owner' });
    await db.customerRef.create({
      data: {
        customerModel: 'Organization',
        customerOrganizationId: customerOrg.organizationId,
        providerModel: 'Space',
        providerSpaceId: space.id,
      },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/customers`));
    expect(response.status).toBe(200);

    const { data } = await json<CustomerRef[]>(response);
    expect(data.some((c) => c.customerOrganizationId === customerOrg.organizationId)).toBe(true);
  });
});
