import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createCustomerRef, createOrganizationUser, createSpace, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { meReadManyProviderRoute } from '#/modules/me/routes/meReadManyProvider';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type ReadManyProvidersResponse = z.infer<typeof meReadManyProviderRoute.responseSchema>[];

describe('GET /me/providers', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let space: Space;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { context } = await createOrganizationUser({}, { user });
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns empty array when user has no providers', async () => {
    const response = await fetch(get('/api/v1/me/providers'));
    const { data, pagination } = await json<ReadManyProvidersResponse>(response);

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(pagination!.total).toBe(0);
  });

  it('returns providers where user is customer', async () => {
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Space',
      customerUser: user,
      providerSpace: space,
    });

    const response = await fetch(get('/api/v1/me/providers'));
    const { data } = await json<ReadManyProvidersResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((p) => p.providerSpaceId === space.id)).toBe(true);
  });

  it('filters by providerModel', async () => {
    const response = await fetch(get('/api/v1/me/providers?providerModel=Space'));
    const { data } = await json<ReadManyProvidersResponse>(response);

    expect(response.status).toBe(200);
    expect(data.every((p) => p.providerModel === 'Space')).toBe(true);
  });

  it('filters by providerSpaceId', async () => {
    const response = await fetch(get(`/api/v1/me/providers?providerSpaceId=${space.id}`));
    const { data } = await json<ReadManyProvidersResponse>(response);

    expect(response.status).toBe(200);
    expect(data.every((p) => p.providerSpaceId === space.id)).toBe(true);
  });

  it('excludes providers for other users', async () => {
    const { entity: otherUser } = await createUser();
    const { context: otherContext } = await createOrganizationUser({}, { user: otherUser });
    const { entity: otherSpace } = await createSpace({}, { organization: otherContext.organization });
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Space',
      customerUser: otherUser,
      providerSpace: otherSpace,
    });

    const response = await fetch(get('/api/v1/me/providers'));
    const { data } = await json<ReadManyProvidersResponse>(response);

    expect(response.status).toBe(200);
    expect(data.every((p) => p.customerUserId === user.id)).toBe(true);
  });
});
