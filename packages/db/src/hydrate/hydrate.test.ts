import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  fetchCachedRecordsWithTargetEntitlements,
  fetchCachedRecordWithTargetEntitlements,
} from '@template/db/hydrate/fetchCachedRecordWithTargetEntitlements';
import { hydrate, hydrateMany } from '@template/db/hydrate/hydrate';
import { cacheKey } from '@template/db/redis/cache/cacheKey';
import { redisClient } from '@template/db/redis/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSession,
  createToken,
  createUser,
} from '@template/db/test';

describe('hydrate', () => {
  beforeEach(() => {});

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('hydrates single relation', async () => {
    const { entity: token, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const result = await hydrate('token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    expect(result.user).toBeDefined();
    expect((result.user as { id: string }).id).toBe(context.user!.id);
    expect(result.organization).toBeDefined();
    expect((result.organization as { id: string }).id).toBe(context.organization!.id);
  });

  it('hydrates nested relations - token -> orgUser -> org', async () => {
    const { entity: token, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const result = await hydrate('token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    // Token -> OrganizationUser (composite FK)
    expect(result.organizationUser).toBeDefined();
    const hydratedOrgUser = result.organizationUser as { organization: { id: string } };
    expect(hydratedOrgUser.organization).toBeDefined();
    expect(hydratedOrgUser.organization.id).toBe(context.organization!.id);
  });

  it('attaches an organization reached on two paths on both', async () => {
    const { entity: token, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const result = await hydrate('token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    const organizationId = context.organization!.id;
    expect((result.organization as { id: string }).id).toBe(organizationId);
    expect((result.organizationUser as { organization: { id: string } }).organization.id).toBe(
      organizationId,
    );
  });

  it('handles null FK gracefully', async () => {
    const { entity: user } = await createUser();

    const result = await hydrate('user', { id: user.id });

    expect(result.id).toBe(user.id);
  });

  it('handles missing related record gracefully', async () => {
    const { entity: session, context } = await createSession();

    // Delete user to create orphan
    await db.user.delete({ where: { id: context.user!.id } });

    const result = await hydrate('session', { id: session.id, userId: session.userId });
    expect(result.user).toBeUndefined();
  });
});

describe('fetchCachedRecordWithTargetEntitlements', () => {
  beforeEach(() => {});

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('fetches by simple id', async () => {
    const { entity: user } = await createUser();

    const result = await fetchCachedRecordWithTargetEntitlements('user', user.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(user.id);
  });

  it('fetches by composite key', async () => {
    const { entity: orgUser } = await createOrganizationUser();

    const result = await fetchCachedRecordWithTargetEntitlements('organizationUser', {
      organizationId: orgUser.organizationId,
      userId: orgUser.userId,
    });

    expect(result).toBeDefined();
    expect(result?.organizationId).toBe(orgUser.organizationId);
    expect(result?.userId).toBe(orgUser.userId);
  });

  it('returns null for missing record', async () => {
    const result = await fetchCachedRecordWithTargetEntitlements('user', 'nonexistent-id');
    expect(result).toBeNull();
  });

  it('a withDeleted read through fetchCachedRecordWithTargetEntitlements gets the not-deleted view and caches it', async () => {
    const { entity: user } = await createUser();
    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(
      await db.withDeleted(() => db.user.findFirst({ where: { id: user.id } })),
    ).not.toBeNull();

    expect(
      await db.withDeleted(() => fetchCachedRecordWithTargetEntitlements('user', user.id)),
    ).toBeNull();
    expect(await redisClient().exists(cacheKey('user', user.id))).toBe(1);
    expect(await fetchCachedRecordWithTargetEntitlements('user', user.id)).toBeNull();
  });

  it('hydrates not-deleted relations only, even inside a withDeleted block', async () => {
    const { entity: token } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });
    await db.organizationUser.update({
      where: {
        organizationId_userId: {
          organizationId: token.organizationId as string,
          userId: token.userId as string,
        },
      },
      data: { deletedAt: new Date() },
    });

    const result = await db.withDeleted(() =>
      hydrate('token', {
        id: token.id,
        ownerModel: token.ownerModel,
        organizationId: token.organizationId,
        userId: token.userId,
      }),
    );

    expect(result.organizationUser).toBeUndefined();
  });

  it('hydrates a batch with hydrateMany sharing hydrated parent objects across rows', async () => {
    const { entity: tokenA, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });
    const { entity: tokenB } = await createToken({
      ownerModel: TokenOwnerModel.OrganizationUser,
      organizationId: context.organization!.id,
      userId: context.user!.id,
    });

    const hydrated = await hydrateMany('token', [
      {
        id: tokenA.id,
        userId: tokenA.userId,
        organizationId: tokenA.organizationId,
      },
      {
        id: tokenB.id,
        userId: tokenB.userId,
        organizationId: tokenB.organizationId,
      },
    ]);

    expect(hydrated).toHaveLength(2);
    expect(hydrated[0]!.organization).toBe(hydrated[1]!.organization);
    expect(hydrated[0]!.organizationUser).toBe(hydrated[1]!.organizationUser);
    expect((hydrated[0]!.organization as { id: string }).id).toBe(context.organization!.id);
  });

  it('batches MGET + findMany in fetchCachedRecordsWithTargetEntitlements and caches hits and misses', async () => {
    const { entity: userA } = await createUser();
    const { entity: userB } = await createUser();
    const { entity: deletedUser } = await createUser();
    await db.user.update({ where: { id: deletedUser.id }, data: { deletedAt: new Date() } });

    const rows = await db.withDeleted(() =>
      fetchCachedRecordsWithTargetEntitlements('user', [
        userA.id,
        'missing-id',
        userB.id,
        deletedUser.id,
      ]),
    );

    expect(rows.map((row) => row?.id ?? null)).toEqual([userA.id, null, userB.id, null]);
    expect(await redisClient().exists(cacheKey('user', userA.id))).toBe(1);
    expect(await redisClient().exists(cacheKey('user', 'missing-id'))).toBe(1);
    expect(await redisClient().exists(cacheKey('user', deletedUser.id))).toBe(1);

    // Warm hit path returns identical positional results directly from Redis MGET.
    const warmRows = await fetchCachedRecordsWithTargetEntitlements('user', [
      userB.id,
      'missing-id',
      userA.id,
    ]);
    expect(warmRows.map((row) => row?.id ?? null)).toEqual([userB.id, null, userA.id]);

    // Heterogeneous key shapes, duplicate keys, and corrupt cache payload self-healing.
    const { entity: userC } = await createUser();
    const corruptKey = cacheKey('user', userC.id);
    await redisClient().set(corruptKey, '{not-valid-superjson');
    const mixed = await fetchCachedRecordsWithTargetEntitlements('user', [
      userC.id,
      { email: userB.email },
      userC.id,
    ]);
    expect(mixed.map((row) => row?.id ?? null)).toEqual([userC.id, userB.id, userC.id]);
    const healedPayload = await redisClient().get(corruptKey);
    expect(healedPayload).not.toBe('{not-valid-superjson');
  });
});
