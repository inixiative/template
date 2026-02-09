import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, Space, SpaceUser, Token, User } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/tokens', () => {
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

  it('returns empty array when no tokens', async () => {
    const response = await fetch(get(`/api/v1/space/${space.id}/tokens`));
    expect(response.status).toBe(200);

    const { data } = await json<Token[]>(response);
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns space tokens', async () => {
    const uniqueHash = `hash_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await db.token.create({
      data: {
        name: 'Test Token',
        keyHash: uniqueHash,
        keyPrefix: 'test',
        ownerModel: 'Space',
        organizationId: org.id,
        spaceId: space.id,
        role: 'member',
      },
    });

    const response = await fetch(get(`/api/v1/space/${space.id}/tokens`));
    expect(response.status).toBe(200);

    const { data } = await json<Token[]>(response);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((t) => t.name === 'Test Token')).toBe(true);
  });

  it('allows member to view tokens (read permission)', async () => {
    const { entity: memberOrgUser, context: memberCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const memberSpaceUser = await db.spaceUser.create({
      data: {
        role: 'member',
        organizationId: org.id,
        spaceId: space.id,
        userId: memberCtx.user.id,
      },
    });

    const memberHarness = createTestApp({
      mockUser: memberCtx.user,
      mockOrganizationUsers: [memberOrgUser],
      mockSpaceUsers: [memberSpaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await memberHarness.fetch(get(`/api/v1/space/${space.id}/tokens`));
    expect(response.status).toBe(200);
  });

  it('returns 403 for user without space access', async () => {
    const { entity: otherOrgUser, context: otherCtx } = await createOrganizationUser({ role: 'member' });

    const otherHarness = createTestApp({
      mockUser: otherCtx.user,
      mockOrganizationUsers: [otherOrgUser],
      mockSpaceUsers: [],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });

    const response = await otherHarness.fetch(get(`/api/v1/space/${space.id}/tokens`));
    expect(response.status).toBe(403);
  });
});
