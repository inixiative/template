import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cacheKey, db, fetchOne, getRedisClient, unregisterDbHook } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';

// Membership and user changes reach the next request through the cache hooks the app registers.
beforeAll(() => registerClearCacheHook());
afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const mintKey = () => {
  const rawKey = randomBytes(24).toString('hex');
  return {
    rawKey,
    fields: {
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 16),
    },
  };
};

const userToken = async (user: User, expiresAt: Date | null = null) => {
  const { rawKey, fields } = mintKey();
  await createToken({ ownerModel: 'User', role: 'owner', expiresAt, ...fields }, { user });
  return { authorization: `Bearer ${rawKey}` };
};

const organizationToken = async (organization: Organization) => {
  const { rawKey, fields } = mintKey();
  await createToken({ ownerModel: 'Organization', role: 'owner', ...fields }, { organization });
  return { authorization: `Bearer ${rawKey}` };
};

const spaceToken = async (space: Space) => {
  const { rawKey, fields } = mintKey();
  await createToken({ ownerModel: 'Space', role: 'owner', ...fields }, { space });
  return { authorization: `Bearer ${rawKey}` };
};

const organizationUserToken = async (organizationUser: OrganizationUser) => {
  const { rawKey, fields } = mintKey();
  await createToken(
    { ownerModel: 'OrganizationUser', role: 'owner', ...fields },
    { organizationUser },
  );
  return { authorization: `Bearer ${rawKey}` };
};

const spaceUserToken = async (spaceUser: SpaceUser) => {
  const { rawKey, fields } = mintKey();
  await createToken({ ownerModel: 'SpaceUser', role: 'owner', ...fields }, { spaceUser });
  return { authorization: `Bearer ${rawKey}` };
};

const readMe = (headers: Record<string, string>) => app.request('/api/v1/me', { headers });

const { app: tokenApp } = createTestApp({
  mount: [
    (app) => {
      app.use('*', tokenAuthMiddleware);
      app.get('/echo', (c) =>
        c.json({
          tokenId: c.get('token')?.id ?? null,
          organizationUsers: c.get('organizationUsers') ?? [],
          spaceUsers: c.get('spaceUsers') ?? [],
          spaces: c.get('spaces') ?? [],
        }),
      );
    },
  ],
});

const authenticatedTokenId = async (headers: Record<string, string>) => {
  const response = await tokenApp.request('/echo', { headers });
  return ((await response.json()) as { tokenId: string | null }).tokenId;
};

const rename = (path: string, headers: Record<string, string>) =>
  app.request(path, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `renamed-${randomUUID().slice(0, 6)}` }),
  });

describe('an OrganizationUser token follows its membership, not the cached token', () => {
  let organization: Organization;
  let organizationPath: string;

  const member = async (role: 'owner' | 'viewer', user?: User) => {
    const { entity } = await createOrganizationUser(
      { role },
      user ? { organization, user } : { organization },
    );
    return entity;
  };

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    organizationPath = `/api/v1/organization/${organization.id}`;
  });

  it('a demoted member loses the role on the next request', async () => {
    const membership = await member('owner');
    const headers = await organizationUserToken(membership);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({ where: { id: membership.id }, data: { role: 'viewer' } });
    expect((await rename(organizationPath, headers)).status).toBe(403);
  });

  it('a promoted member gains the role on the next request', async () => {
    const membership = await member('viewer');
    const headers = await organizationUserToken(membership);
    expect((await rename(organizationPath, headers)).status).toBe(403);

    await db.organizationUser.update({ where: { id: membership.id }, data: { role: 'owner' } });
    expect((await rename(organizationPath, headers)).status).toBe(200);
  });

  it('a removed member is refused while the token row is still cached', async () => {
    const membership = await member('owner');
    const headers = await organizationUserToken(membership);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    // The FK cascade deletes the token with no Token hook firing, so its cache entry survives.
    await db.organizationUser.delete({ where: { id: membership.id } });
    expect((await readMe(headers)).status).toBe(401);
  });

  it('a soft-deleted membership is refused', async () => {
    const membership = await member('owner');
    const headers = await organizationUserToken(membership);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({
      where: { id: membership.id },
      data: { deletedAt: new Date() },
    });
    expect((await readMe(headers)).status).toBe(401);
  });

  it('a revoked superadmin loses the reach on the next request', async () => {
    const { entity: user } = await createUser({ platformRole: PlatformRole.superadmin });
    const headers = await organizationUserToken(await member('viewer', user));
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.user.update({ where: { id: user.id }, data: { platformRole: PlatformRole.user } });
    expect((await rename(organizationPath, headers)).status).toBe(403);
  });
});

describe('a SpaceUser token follows its membership, not the cached token', () => {
  let organization: Organization;
  let space: Space;
  let spacePath: string;

  const spaceMember = async (role: 'owner' | 'viewer') => {
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { entity: spaceUser } = await createSpaceUser({ role }, { ...context, space });
    return { organizationUser, spaceUser };
  };

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    spacePath = `/api/v1/space/${space.id}`;
  });

  it('a demoted space member loses the role on the next request', async () => {
    const { spaceUser } = await spaceMember('owner');
    const headers = await spaceUserToken(spaceUser);
    expect((await rename(spacePath, headers)).status).toBe(200);

    await db.spaceUser.update({ where: { id: spaceUser.id }, data: { role: 'viewer' } });
    expect((await rename(spacePath, headers)).status).toBe(403);
  });

  it("the space token's context names no seats: it reaches its space through its seat's table", async () => {
    const { spaceUser } = await spaceMember('owner');
    const headers = await spaceUserToken(spaceUser);
    const context = (await (await tokenApp.request('/echo', { headers })).json()) as {
      organizationUsers: object[];
      spaceUsers: object[];
    };

    expect(context.organizationUsers).toHaveLength(0);
    expect(context.spaceUsers).toHaveLength(0);
    expect((await rename(spacePath, headers)).status).toBe(200);
  });

  it('a removed space member is refused while the token row is still cached', async () => {
    const { spaceUser } = await spaceMember('owner');
    const headers = await spaceUserToken(spaceUser);
    expect((await rename(spacePath, headers)).status).toBe(200);

    await db.spaceUser.delete({ where: { id: spaceUser.id } });
    expect((await readMe(headers)).status).toBe(401);
  });

  it('removing the org membership refuses the space token', async () => {
    const { organizationUser, spaceUser } = await spaceMember('owner');
    const headers = await spaceUserToken(spaceUser);
    expect((await rename(spacePath, headers)).status).toBe(200);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { deletedAt: new Date() },
    });
    expect((await readMe(headers)).status).toBe(401);
  });
});

describe('the cache hook clears the keys membership records are read under', () => {
  it('a SpaceUser write clears its full unique key', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const { context } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const identifier = {
      organizationId: spaceUser.organizationId,
      spaceId: spaceUser.spaceId,
      userId: spaceUser.userId,
    };

    expect((await fetchOne<SpaceUser>('spaceUser', identifier))?.role).toBe('owner');
    await db.spaceUser.update({ where: { id: spaceUser.id }, data: { role: 'viewer' } });
    expect(await getRedisClient().exists(cacheKey('spaceUser', identifier))).toBe(0);
    expect((await fetchOne<SpaceUser>('spaceUser', identifier))?.role).toBe('viewer');
  });

  it("a Space write clears the composite key hydrate reads a token's space under", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const identifier = { organizationId: organization.id, id: space.id };

    await fetchOne<Space>('space', identifier);
    expect(await getRedisClient().exists(cacheKey('space', identifier))).toBe(1);
    await db.space.update({ where: { id: space.id }, data: { name: 'renamed space' } });
    expect(await getRedisClient().exists(cacheKey('space', identifier))).toBe(0);
  });
});

describe('every token type is refused once its owner is gone', () => {
  it("a User token follows the user's memberships on the next request", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: membership, context } = await createOrganizationUser(
      { role: 'owner' },
      { organization },
    );
    const headers = await userToken(context.user);
    const organizationPath = `/api/v1/organization/${organization.id}`;
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({ where: { id: membership.id }, data: { role: 'viewer' } });
    expect((await rename(organizationPath, headers)).status).toBe(403);
  });

  it('an Organization token is refused once the organization is soft-deleted', async () => {
    const { entity: organization } = await createOrganization();
    const headers = await organizationToken(organization);
    expect(await authenticatedTokenId(headers)).not.toBeNull();

    await db.organization.update({
      where: { id: organization.id },
      data: { deletedAt: new Date() },
    });
    expect(await authenticatedTokenId(headers)).toBeNull();
  });

  it('a Space token is refused once the space is soft-deleted', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const headers = await spaceToken(space);
    expect(await authenticatedTokenId(headers)).not.toBeNull();

    await db.space.update({ where: { id: space.id }, data: { deletedAt: new Date() } });
    expect(await authenticatedTokenId(headers)).toBeNull();
  });

  it('a token that expires while its row is cached is refused', async () => {
    const { entity: user } = await createUser();
    const headers = await userToken(user, new Date(Date.now() + 1500));
    expect(await authenticatedTokenId(headers)).not.toBeNull();

    await Bun.sleep(1600);
    expect(await authenticatedTokenId(headers)).toBeNull();
  });
});
