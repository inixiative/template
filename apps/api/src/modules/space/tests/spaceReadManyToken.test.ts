import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Role, Space, Token } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/v1/space/:id/tokens', () => {
  let organization: Organization;
  let space: Space;

  const spaceMember = async (role: Role) => {
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { entity: spaceUser } = await createSpaceUser({ role }, { ...context, space });
    return createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [organizationUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
  };

  beforeAll(async () => {
    ({ organization } = (await createOrganizationUser({ role: 'member' })).context);
    ({ entity: space } = await createSpace({}, { organization }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('a space owner lists the space tokens', async () => {
    await createToken({ name: 'Test Token', ownerModel: 'Space', role: 'member' }, { space });

    const response = await (await spaceMember('owner')).fetch(
      get(`/api/v1/space/${space.id}/tokens`),
    );
    expect(response.status).toBe(200);

    const { data } = await json<Token[]>(response);
    expect(data.some((token) => token.name === 'Test Token')).toBe(true);
  });

  it('a space admin or member does not list tokens: token list read is own at the owner (R38)', async () => {
    for (const role of ['admin', 'member'] as const) {
      const response = await (await spaceMember(role)).fetch(
        get(`/api/v1/space/${space.id}/tokens`),
      );
      expect(response.status).toBe(403);
    }
  });

  it('returns 403 for user without space access', async () => {
    const { entity: otherOrgUser, context: otherCtx } = await createOrganizationUser({
      role: 'member',
    });

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
