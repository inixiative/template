import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, User } from '@template/db/generated/client/client';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { meRouter } from '#/modules/me';
import type { meReadManyTokensRoute } from '#/modules/me/routes/meReadManyTokens';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type ReadManyTokensResponse = z.infer<typeof meReadManyTokensRoute.responseSchema>[];

describe('GET /me/tokens', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { entity: o } = await createOrganization();
    org = o;

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

  it('returns empty array when user has no tokens', async () => {
    const response = await fetch(get('/api/v1/me/tokens'));
    const { data, pagination } = await json<ReadManyTokensResponse>(response);

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(pagination!.total).toBe(0);
  });

  it('returns user-owned tokens', async () => {
    await createToken(
      {
        name: 'User Token',
        ownerModel: TokenOwnerModel.User,
      },
      { user },
    );

    const response = await fetch(get('/api/v1/me/tokens'));
    const { data } = await json<ReadManyTokensResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((t) => t.name === 'User Token')).toBe(true);
  });

  it('excludes org-owned tokens', async () => {
    await createToken(
      {
        name: 'Org Token',
        ownerModel: TokenOwnerModel.Organization,
      },
      { organization: org },
    );

    const response = await fetch(get('/api/v1/me/tokens'));
    const { data } = await json<ReadManyTokensResponse>(response);

    expect(response.status).toBe(200);
    expect(data.some((t) => t.name === 'Org Token')).toBe(false);
  });

  it("returns the user's membership tokens, each carrying the org and space it belongs to", async () => {
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'member' },
      { user, organization: org },
    );
    const { entity: space } = await createSpace({}, { organization: org });
    const { entity: spaceUser } = await createSpaceUser(
      { role: 'member' },
      { user, organization: org, organizationUser, space },
    );
    await createToken(
      { name: 'Membership Token', ownerModel: TokenOwnerModel.OrganizationUser },
      { organizationUser, organization: org },
    );
    await createToken(
      { name: 'Space Membership Token', ownerModel: TokenOwnerModel.SpaceUser },
      { spaceUser, space, organization: org },
    );

    const response = await fetch(get('/api/v1/me/tokens'));
    const { data } = await json<ReadManyTokensResponse>(response);

    expect(response.status).toBe(200);
    const byName = Object.fromEntries(data.map((t) => [t.name, t]));
    expect(byName['Membership Token']).toMatchObject({
      ownerModel: 'OrganizationUser',
      organization: { id: org.id },
      organizationUser: { id: organizationUser.id },
      space: null,
      spaceUser: null,
    });
    expect(byName['Space Membership Token']).toMatchObject({
      ownerModel: 'SpaceUser',
      organization: { id: org.id },
      space: { id: space.id },
      spaceUser: { id: spaceUser.id },
    });
    expect(byName['User Token']).toMatchObject({ organization: null, space: null });
  });

  it('omits keyHash from response', async () => {
    const response = await fetch(get('/api/v1/me/tokens'));
    const { data } = await json<ReadManyTokensResponse>(response);

    if (data.length > 0) {
      expect((data[0] as Record<string, unknown>).keyHash).toBeUndefined();
      expect(data[0].keyPrefix).toBeDefined();
    }
  });
});
