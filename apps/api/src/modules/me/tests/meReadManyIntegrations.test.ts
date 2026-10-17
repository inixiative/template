import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Integration, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/me/integrations', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let otherUser: User;
  let names: [string, string, string];
  let customName: string;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;
    const { entity: other } = await createUser();
    otherUser = other;

    const seq = getNextSeq();
    names = [`Mine A ${seq}`, `Mine B ${seq}`, `Mine C ${seq}`];
    for (const name of names) {
      await createIntegration({ name, provider: 'github', ownerModel: 'User', userId: user.id });
    }
    customName = `Custom ${seq}`;
    await createIntegration({
      name: customName,
      provider: null,
      ownerModel: 'User',
      userId: user.id,
    });
    await createIntegration({ name: `Theirs ${seq}`, ownerModel: 'User', userId: otherUser.id });
    const { entity: orgUser, context: orgUserContext } = await createOrganizationUser(
      { role: 'owner' },
      { user },
    );
    await createIntegration({
      name: `Org ${seq}`,
      ownerModel: 'Organization',
      organizationId: orgUser.organizationId,
    });
    await createIntegration({
      name: `Membership ${seq}`,
      ownerModel: 'OrganizationUser',
      organizationId: orgUser.organizationId,
      userId: user.id,
    });
    const { entity: space } = await createSpace({}, { organization: orgUserContext.organization });
    await createSpaceUser({ role: 'owner' }, { ...orgUserContext, space });
    await createIntegration({
      name: `Space membership ${seq}`,
      ownerModel: 'SpaceUser',
      organizationId: orgUser.organizationId,
      spaceId: space.id,
      userId: user.id,
    });
    const { entity: removed } = await createIntegration({
      name: `Removed ${seq}`,
      ownerModel: 'User',
      userId: user.id,
    });

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
    await db.integration.update({ where: { id: removed.id }, data: { deletedAt: new Date() } });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("lists only the user's personal integrations", async () => {
    const response = await fetch(get('/api/v1/me/integrations'));
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name).sort()).toEqual(
      [...names, customName].sort(),
    );
    expect(
      data.every(
        (integration) => integration.ownerModel === 'User' && integration.userId === user.id,
      ),
    ).toBe(true);
  });

  it('paginates', async () => {
    const response = await fetch(get('/api/v1/me/integrations?page=1&pageSize=2'));
    const { data, pagination } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(pagination?.total).toBe(4);
    expect(pagination?.pageSize).toBe(2);
  });

  it('returns custom integrations, which have no provider, under a null provider filter', async () => {
    const response = await fetch(
      get('/api/v1/me/integrations?searchFields[provider][equals][:]=null'),
    );
    const { data, pagination } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => [integration.name, integration.provider])).toEqual([
      [customName, null],
    ]);
    expect(pagination?.total).toBe(1);
  });

  it('filters by provider', async () => {
    const response = await fetch(
      get('/api/v1/me/integrations?searchFields[provider][equals]=github&pageSize=2'),
    );
    const { data, pagination } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data.every((integration) => integration.provider === 'github')).toBe(true);
    expect(pagination?.total).toBe(3);
  });

  it('filters through the lens', async () => {
    const response = await fetch(
      get(`/api/v1/me/integrations?searchFields[name]=${encodeURIComponent(names[1])}`),
    );
    const { data } = await json<Integration[]>(response);

    expect(response.status).toBe(200);
    expect(data.map((integration) => integration.name)).toEqual([names[1]]);
  });

  it('returns exactly the integration read fields', async () => {
    const response = await fetch(get('/api/v1/me/integrations'));
    const { data } = await json<Integration[]>(response);
    const readFields = Object.keys(integrationReadResponseSchema.shape).sort();

    for (const integration of data) {
      expect(Object.keys(integration).sort()).toEqual(readFields);
    }
  });
});
