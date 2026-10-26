import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  type AccessorName,
  cacheKey,
  db,
  fetchOne,
  getRedisClient,
  unregisterDbHook,
} from '@template/db';
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
  createIntegration,
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

// Member and user changes reach the next request through the cache hooks the app registers.
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

describe('an OrganizationUser token follows its member row, not the cached token', () => {
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
    const organizationUser = await member('owner');
    const headers = await organizationUserToken(organizationUser);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { role: 'viewer' },
    });
    expect((await rename(organizationPath, headers)).status).toBe(403);
  });

  it('a promoted member gains the role on the next request', async () => {
    const organizationUser = await member('viewer');
    const headers = await organizationUserToken(organizationUser);
    expect((await rename(organizationPath, headers)).status).toBe(403);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { role: 'owner' },
    });
    expect((await rename(organizationPath, headers)).status).toBe(200);
  });

  it('a removed member is refused while the token row is still cached', async () => {
    const organizationUser = await member('owner');
    const headers = await organizationUserToken(organizationUser);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    // The FK cascade deletes the token with no Token hook firing, so its cache entry survives.
    await db.organizationUser.delete({ where: { id: organizationUser.id } });
    expect((await readMe(headers)).status).toBe(401);
  });

  it('a soft-deleted member row is refused', async () => {
    const organizationUser = await member('owner');
    const headers = await organizationUserToken(organizationUser);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { deletedAt: new Date() },
    });
    expect((await readMe(headers)).status).toBe(401);
  });

  it("a superadmin's member token is not superadmin; their own token is, until revoked", async () => {
    const { entity: user } = await createUser({ platformRole: PlatformRole.superadmin });
    const memberHeaders = await organizationUserToken(await member('viewer', user));
    expect((await rename(organizationPath, memberHeaders)).status).toBe(403);

    const headers = await userToken(user);
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.user.update({ where: { id: user.id }, data: { platformRole: PlatformRole.user } });
    expect((await rename(organizationPath, headers)).status).toBe(403);
  });
});

describe('a SpaceUser token follows its member row, not the cached token', () => {
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

  it("the space token's context names no members: it reaches its space through its member's table", async () => {
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

  it('removing the org member row refuses the space token', async () => {
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

describe('the cache hook clears the keys member records are read under', () => {
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
  it("a User token follows the user's members on the next request", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role: 'owner' },
      { organization },
    );
    const headers = await userToken(context.user);
    const organizationPath = `/api/v1/organization/${organization.id}`;
    expect((await rename(organizationPath, headers)).status).toBe(200);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { role: 'viewer' },
    });
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

  it('an Integration token is refused once the integration is soft-deleted', async () => {
    const { entity: user } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'Integration', role: 'owner', ...fields }, { integration });
    const headers = { authorization: `Bearer ${rawKey}` };
    expect(await authenticatedTokenId(headers)).not.toBeNull();

    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: new Date() } });
    expect(await authenticatedTokenId(headers)).toBeNull();
  });

  it('a deactivated token is refused, cached or not', async () => {
    const { entity: user } = await createUser();
    const { rawKey, fields } = mintKey();
    const { entity: token } = await createToken(
      { ownerModel: 'User', role: 'owner', ...fields },
      { user },
    );
    const headers = { authorization: `Bearer ${rawKey}` };
    expect(await authenticatedTokenId(headers)).toBe(token.id);

    await db.token.update({ where: { id: token.id }, data: { isActive: false } });
    expect(await authenticatedTokenId(headers)).toBeNull();
  });

  it('lastUsedAt marks an accepted use: a refused token is not stamped', async () => {
    const { entity: user } = await createUser();
    const live = mintKey();
    const { entity: accepted } = await createToken(
      { ownerModel: 'User', role: 'owner', ...live.fields },
      { user },
    );
    const dead = mintKey();
    const { entity: refused } = await createToken(
      { ownerModel: 'User', role: 'owner', expiresAt: new Date(Date.now() - 1000), ...dead.fields },
      { user },
    );
    await authenticatedTokenId({ authorization: `Bearer ${live.rawKey}` });
    await authenticatedTokenId({ authorization: `Bearer ${dead.rawKey}` });
    expect(
      (await db.token.findUniqueOrThrow({ where: { id: accepted.id } })).lastUsedAt,
    ).not.toBeNull();
    expect((await db.token.findUniqueOrThrow({ where: { id: refused.id } })).lastUsedAt).toBeNull();
  });

  it('a token minted already expired is refused', async () => {
    const { entity: user } = await createUser();
    const headers = await userToken(user, new Date(Date.now() - 1000));
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

describe('a token is refused once anything its owner stands on is gone, cached or not', () => {
  type Owned = {
    headers: Record<string, string>;
    removals: Record<string, () => Promise<unknown>>;
  };

  const softDelete = (accessor: AccessorName, id: string) => () =>
    db.delegate(accessor).update({ where: { id }, data: { deletedAt: new Date() } });

  const owners: Record<string, () => Promise<Owned>> = {
    User: async () => {
      const { entity: user } = await createUser();
      return { headers: await userToken(user), removals: { user: softDelete('user', user.id) } };
    },
    Organization: async () => {
      const { entity: organization } = await createOrganization();
      return {
        headers: await organizationToken(organization),
        removals: { organization: softDelete('organization', organization.id) },
      };
    },
    Space: async () => {
      const { entity: organization } = await createOrganization();
      const { entity: space } = await createSpace({}, { organization });
      return {
        headers: await spaceToken(space),
        removals: { space: softDelete('space', space.id) },
      };
    },
    OrganizationUser: async () => {
      const { entity: organizationUser, context } = await createOrganizationUser({ role: 'owner' });
      return {
        headers: await organizationUserToken(organizationUser),
        removals: {
          organizationUser: softDelete('organizationUser', organizationUser.id),
          user: softDelete('user', context.user.id),
          organization: softDelete('organization', context.organization.id),
        },
      };
    },
    SpaceUser: async () => {
      const { entity: organizationUser, context } = await createOrganizationUser({
        role: 'member',
      });
      const { entity: space } = await createSpace({}, { organization: context.organization });
      const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
      return {
        headers: await spaceUserToken(spaceUser),
        removals: {
          spaceUser: softDelete('spaceUser', spaceUser.id),
          organizationUser: softDelete('organizationUser', organizationUser.id),
          space: softDelete('space', space.id),
          user: softDelete('user', context.user.id),
          organization: softDelete('organization', context.organization.id),
        },
      };
    },
    Integration: async () => {
      const { entity: user } = await createUser();
      const { entity: integration } = await createIntegration({
        ownerModel: 'User',
        userId: user.id,
      });
      const { rawKey, fields } = mintKey();
      await createToken({ ownerModel: 'Integration', role: 'owner', ...fields }, { integration });
      return {
        headers: { authorization: `Bearer ${rawKey}` },
        removals: { integration: softDelete('integration', integration.id) },
      };
    },
  };

  for (const [ownerModel, own] of Object.entries(owners)) {
    it(`${ownerModel} token: refused after each removal while its row is cached`, async () => {
      for (const removal of Object.keys((await own()).removals)) {
        const { headers, removals } = await own();
        expect(await authenticatedTokenId(headers)).not.toBeNull();
        await removals[removal]?.();
        expect({ removal, tokenId: await authenticatedTokenId(headers) }).toEqual({
          removal,
          tokenId: null,
        });
      }
    });

    it(`${ownerModel} token: refused after each removal before it was ever used`, async () => {
      for (const removal of Object.keys((await own()).removals)) {
        const { headers, removals } = await own();
        await removals[removal]?.();
        expect({ removal, tokenId: await authenticatedTokenId(headers) }).toEqual({
          removal,
          tokenId: null,
        });
      }
    });
  }
});
