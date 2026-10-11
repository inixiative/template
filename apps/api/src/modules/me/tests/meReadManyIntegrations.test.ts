import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Integration, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
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
    await createIntegration({ name: `Theirs ${seq}`, ownerModel: 'User', userId: otherUser.id });
    const { entity: orgUser } = await createOrganizationUser({ role: 'owner' }, { user });
    await createIntegration({
      name: `Org ${seq}`,
      ownerModel: 'Organization',
      organizationId: orgUser.organizationId,
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
    expect(data.map((integration) => integration.name).sort()).toEqual([...names].sort());
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
    expect(pagination?.total).toBe(3);
    expect(pagination?.pageSize).toBe(2);
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
