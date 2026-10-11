import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type {
  Integration,
  Organization,
  OrganizationUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
  createSpace,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/organization/:id/integrations', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let names: [string, string, string];

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'viewer' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const seq = getNextSeq();
    names = [`Org A ${seq}`, `Org B ${seq}`, `Org C ${seq}`];
    for (const name of names) {
      await createIntegration({
        name,
        provider: 'slack',
        ownerModel: 'Organization',
        organizationId: org.id,
      });
    }

    const { context: otherContext } = await createOrganizationUser();
    await createIntegration({
      name: `Other org ${seq}`,
      ownerModel: 'Organization',
      organizationId: otherContext.organization.id,
    });
    const { entity: space } = await createSpace({}, { organization: org });
    await createIntegration({
      name: `Space ${seq}`,
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    await createIntegration({ name: `Personal ${seq}`, ownerModel: 'User', userId: user.id });
    const { entity: removed } = await createIntegration({
      name: `Removed ${seq}`,
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
    await db.integration.update({ where: { id: removed.id }, data: { deletedAt: new Date() } });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("lists only the organization's own integrations to a member who can read it", async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}/integrations`));
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name).sort()).toEqual([...names].sort());
    expect(
      data.every(
        (integration) =>
          integration.ownerModel === 'Organization' && integration.organizationId === org.id,
      ),
    ).toBe(true);
  });

  it('returns 403 to a user who is not a member', async () => {
    const { entity: outsider } = await createUser();
    const outsiderHarness = createTestApp({
      mockUser: outsider,
      mockOrganizationUsers: [],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });

    const response = await outsiderHarness.fetch(
      get(`/api/v1/organization/${org.id}/integrations`),
    );

    expect(response.status).toBe(403);
  });

  it('paginates', async () => {
    const response = await fetch(
      get(`/api/v1/organization/${org.id}/integrations?page=2&pageSize=2`),
    );
    const { data, pagination } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(pagination?.total).toBe(3);
    expect(pagination?.page).toBe(2);
  });

  it('filters through the lens', async () => {
    const response = await fetch(
      get(
        `/api/v1/organization/${org.id}/integrations?searchFields[name]=${encodeURIComponent(names[2])}`,
      ),
    );
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name)).toEqual([names[2]]);
  });

  it('rejects a filter field outside the lens', async () => {
    const response = await fetch(
      get(`/api/v1/organization/${org.id}/integrations?searchFields[notAField]=x`),
    );

    expect(response.status).toBe(400);
  });

  it('returns exactly the integration read fields', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}/integrations`));
    const { data } = await json<Integration[]>(response);
    const readFields = Object.keys(integrationReadResponseSchema.shape).sort();

    for (const integration of data) {
      expect(Object.keys(integration).sort()).toEqual(readFields);
    }
  });
});
