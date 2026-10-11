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
  createIntegration,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  getNextSeq,
} from '@template/db/test';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/integrations', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;
  let names: [string, string, string];

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'member' });
    orgUser = ou;
    user = context.user;
    org = context.organization;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'viewer' }, { ...context, space });
    spaceUser = su;

    const seq = getNextSeq();
    names = [`Space A ${seq}`, `Space B ${seq}`, `Space C ${seq}`];
    for (const name of names) {
      await createIntegration({
        name,
        provider: 'linear',
        ownerModel: 'Space',
        organizationId: org.id,
        spaceId: space.id,
      });
    }

    const { entity: siblingSpace } = await createSpace({}, { organization: org });
    await createIntegration({
      name: `Sibling space ${seq}`,
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: siblingSpace.id,
    });
    await createIntegration({
      name: `Org ${seq}`,
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const { entity: removed } = await createIntegration({
      name: `Removed ${seq}`,
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
    await db.integration.update({ where: { id: removed.id }, data: { deletedAt: new Date() } });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("lists only the space's own integrations to a member who can read it", async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/integrations`));
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name).sort()).toEqual([...names].sort());
    expect(
      data.every(
        (integration) => integration.ownerModel === 'Space' && integration.spaceId === space.id,
      ),
    ).toBe(true);
  });

  it('returns 403 to a user without access to the space', async () => {
    const { entity: otherOrgUser, context: otherContext } = await createOrganizationUser({
      role: 'owner',
    });
    const otherHarness = createTestApp({
      mockUser: otherContext.user,
      mockOrganizationUsers: [otherOrgUser],
      mockSpaceUsers: [],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await otherHarness.fetch(get(`/api/v1/space/${space.id}/integrations`));

    expect(response.status).toBe(403);
  });

  it('paginates', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/integrations?pageSize=1`));
    const { data, pagination } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(pagination?.total).toBe(3);
    expect(pagination?.totalPages).toBe(3);
  });

  it('filters through the lens', async () => {
    const response = await fetch(
      get(
        `/api/v1/space/${space.id}/integrations?searchFields[name]=${encodeURIComponent(names[0])}`,
      ),
    );
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name)).toEqual([names[0]]);
  });

  it('returns exactly the integration read fields', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/integrations`));
    const { data } = await json<Integration[]>(response);
    const readFields = Object.keys(integrationReadResponseSchema.shape).sort();

    for (const integration of data) {
      expect(Object.keys(integration).sort()).toEqual(readFields);
    }
  });
});
