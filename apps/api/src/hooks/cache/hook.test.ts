import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  cacheKey,
  checkCache,
  clearCacheKeysMatchingPattern,
  db,
  fetchCachedRecordWithTargetEntitlements,
  fetchThroughCache,
  markCacheWritten,
  redisClient,
} from '@template/db';
import type { Organization, OrganizationUser } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createUser,
} from '@template/db/test';
import * as telemetry from '@template/shared/telemetry';
import { fetchTokenContext } from '#/lib/context/fetchTokenContext';
import { findUserWithRelations } from '#/modules/user/services/find';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

const rollingBack = (fn: () => Promise<unknown>) =>
  db
    .txn(async () => {
      await fn();
      throw new Error('rollback');
    })
    .catch(() => {});

const cachedName = async (key: string) => {
  const check = await checkCache<Organization>(key);
  return 'value' in check ? check.value?.name : undefined;
};

const memberKeyOf = (member: { organizationId: string; userId: string }) =>
  cacheKey('organizationUser', { organizationId: member.organizationId, userId: member.userId });

describe('a read through the cache inside a transaction', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('sees the transaction’s own write on a key that was cached before it', async () => {
    const { entity: organization } = await createOrganization();
    await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
    let inside: string | undefined;
    await db.txn(async () => {
      await db.organization.update({
        where: { id: organization.id },
        data: { name: 'written-in-txn' },
      });
      inside = (
        await fetchCachedRecordWithTargetEntitlements<Organization>('organization', organization.id)
      )?.name;
    });
    expect(inside).toBe('written-in-txn');
  });

  it('leaves nothing cached when the transaction rolls back', async () => {
    const { entity: organization } = await createOrganization();
    await rollingBack(async () => {
      await db.organization.update({
        where: { id: organization.id },
        data: { name: 'uncommitted' },
      });
      await clearCacheKeysMatchingPattern(cacheKey('organization', organization.id));
      await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
    });
    expect(
      (await fetchCachedRecordWithTargetEntitlements<Organization>('organization', organization.id))
        ?.name,
    ).toBe(organization.name);
  });

  it('leaves no uncommitted membership in a user’s relations after a rollback', async () => {
    const { entity: user } = await createUser();
    const member = await createOrganizationUser({ role: 'viewer' }, { user });
    await findUserWithRelations(user.id);
    await rollingBack(async () => {
      await db.organizationUser.update({
        where: { id: member.entity.id },
        data: { role: 'owner' },
      });
      await clearCacheKeysMatchingPattern(cacheKey('user', user.id, ['organizationUsers']));
      await clearCacheKeysMatchingPattern(memberKeyOf(member.entity));
      await findUserWithRelations(user.id);
    });
    expect((await findUserWithRelations(user.id))?.organizationUsers[0]?.role).toBe('viewer');
    expect(
      (
        await fetchCachedRecordWithTargetEntitlements<OrganizationUser>('organizationUser', {
          organizationId: member.entity.organizationId,
          userId: member.entity.userId,
        })
      )?.role,
    ).toBe('viewer');
  });

  it('leaves no uncommitted role in a token’s context after a rollback', async () => {
    const member = await createOrganizationUser({ role: 'viewer' });
    const token = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'owner' },
      { organizationUser: member.entity },
    );
    const keyHash = createHash('sha256').update(token.rawKey).digest('hex');
    await fetchTokenContext(keyHash);
    await rollingBack(async () => {
      await db.organizationUser.update({
        where: { id: member.entity.id },
        data: { role: 'owner' },
      });
      await clearCacheKeysMatchingPattern(memberKeyOf(member.entity));
      await fetchTokenContext(keyHash);
    });
    const after = await fetchTokenContext(keyHash);
    const role = (after?.context.token as unknown as { organizationUser: { role: string } })
      .organizationUser.role;
    expect(role).toBe('viewer');
  });
  it('drops a value a sibling computed from the row before a write in the same transaction', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    let after: string | undefined;
    await db.txn(async () => {
      const sibling = fetchThroughCache(key, async () => {
        const read = await db.organization.findUnique({ where: { id: organization.id } });
        await released;
        return read;
      });
      const write = db.organization.update({
        where: { id: organization.id },
        data: { name: 'written-by-sibling' },
      });
      setTimeout(release, 50);
      await Promise.all([sibling, write]);
      after = (
        await fetchCachedRecordWithTargetEntitlements<Organization>('organization', organization.id)
      )?.name;
    });
    expect(after).toBe('written-by-sibling');
  });
  it('publishes a value it computed when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await db.txn(async () => {
      await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
      expect(await cachedName(key)).toBeUndefined();
    });
    expect(await cachedName(key)).toBe(organization.name);
  });

  it('publishes the value it recomputed after its own write when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
    await db.txn(async () => {
      await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
      await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
    });
    expect(await cachedName(key)).toBe('renamed');
  });

  it('clears a key it wrote and did not read again when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
    await db.txn(async () => {
      await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
    });
    expect(await cachedName(key)).toBeUndefined();
  });

  it('does not publish a value computed before another clear of the key landed', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await db.txn(async () => {
      await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
      await clearCacheKeysMatchingPattern(key);
    });
    expect(await cachedName(key)).toBeUndefined();
  });
  it('refuses to mark a pattern, so every clear a write makes is an exact key', async () => {
    const { entity: organization } = await createOrganization();
    await expect(
      db.txn(() => markCacheWritten([cacheKey('organization', organization.id, [], true)])),
    ).rejects.toThrow('markCacheWritten() takes exact keys');
  });
  it('publishes a key whose data holds a star as itself, clearing no other key', async () => {
    const mine = cacheKey('User', 'a*b@example.com', ['email']);
    const other = cacheKey('User', 'aXb@example.com', ['email']);
    await fetchThroughCache(other, async () => 'other');
    await db.txn(async () => {
      await fetchThroughCache(mine, async () => 'mine');
    });
    const read = async (key: string) => {
      const check = await checkCache<string>(key);
      return 'value' in check ? check.value : undefined;
    };
    expect(await read(other)).toBe('other');
    expect(await read(mine)).toBe('mine');
  });
  it('computes the not-deleted view under withDeleted, and reads and writes the shared key', async () => {
    const { entity: user } = await createUser();
    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(
      await db.withDeleted(() => db.user.findFirst({ where: { id: user.id } })),
    ).not.toBeNull();

    expect(
      await db.withDeleted(() => fetchCachedRecordWithTargetEntitlements('user', user.id)),
    ).toBeNull();
    const check = await checkCache<unknown>(cacheKey('user', user.id));
    expect('value' in check ? check.value : 'miss').toBeNull();

    const shared = cacheKey('organization', 'withDeleted-shared');
    await fetchThroughCache(shared, async () => 'notDeleted');
    expect(await db.withDeleted(() => fetchThroughCache(shared, async () => 'recomputed'))).toBe(
      'notDeleted',
    );
    expect(
      await db.txn(() => db.withDeleted(() => fetchThroughCache(shared, async () => 'in-txn'))),
    ).toBe('notDeleted');
  });

  it('drops a member’s cached relations when their organization is soft-deleted', async () => {
    const { entity: user } = await createUser();
    const member = await createOrganizationUser({ role: 'owner' }, { user });
    expect((await findUserWithRelations(user.id))?.organizations).toHaveLength(1);
    await db.organization.update({
      where: { id: member.entity.organizationId },
      data: { deletedAt: new Date() },
    });
    expect((await findUserWithRelations(user.id))?.organizations).toHaveLength(0);
  });

  it('throws a failed clear at commit only after the onCommit batches ran', async () => {
    const { entity: organization } = await createOrganization();
    let batchRan = false;
    const evalSpy = spyOn(redisClient(), 'eval').mockRejectedValueOnce(new Error('redis down'));
    try {
      await expect(
        db.txn(async () => {
          await db.organization.update({ where: { id: organization.id }, data: { name: 'x' } });
          db.onCommit(() => {
            batchRan = true;
          });
        }),
      ).rejects.toThrow('redis down');
    } finally {
      evalSpy.mockRestore();
    }
    expect(batchRan).toBe(true);
  });

  it('clears a key it wrote before its held locks drop, and publishes one it only read after', async () => {
    const { entity: written } = await createOrganization();
    const { entity: read } = await createOrganization();
    const writtenKey = cacheKey('organization', written.id);
    const readKey = cacheKey('organization', read.id);
    await fetchCachedRecordWithTargetEntitlements('organization', written.id);
    let atLockRelease: { written?: string; read?: string } = {};
    await db.txn(async () => {
      await db.organization.update({ where: { id: written.id }, data: { name: 'renamed' } });
      await fetchCachedRecordWithTargetEntitlements('organization', read.id);
      db.onFinally(async () => {
        atLockRelease = { written: await cachedName(writtenKey), read: await cachedName(readKey) };
      });
    });
    expect(atLockRelease).toEqual({ written: undefined, read: undefined });
    expect(await cachedName(readKey)).toBe(read.name);
  });

  it('does not throw when publishing a value it only read fails at commit', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    let evalSpy: ReturnType<typeof spyOn> | undefined;
    try {
      await db.txn(async () => {
        await fetchCachedRecordWithTargetEntitlements('organization', organization.id);
        db.onFinally(() => {
          evalSpy = spyOn(redisClient(), 'eval').mockRejectedValueOnce(new Error('redis down'));
        });
      });
    } finally {
      evalSpy?.mockRestore();
    }
    expect(await cachedName(key)).toBeUndefined();
  });

  const committedName = async (id: string) =>
    (await db.organization.findUnique({ where: { id }, select: { name: true } }))?.name;

  it('keeps the write committed when publishing a key it wrote fails, and reports the failure after commit', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    const redis = redisClient();
    const realEval = redis.eval.bind(redis) as (...args: unknown[]) => Promise<unknown>;
    let evalSpy: ReturnType<typeof spyOn> | undefined;
    try {
      const txn = db.txn(async () => {
        await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
        evalSpy = spyOn(redis, 'eval').mockImplementation(((...args: unknown[]) =>
          args.includes(key)
            ? Promise.reject(new Error('redis down'))
            : realEval(...args)) as typeof redis.eval);
      });
      await expect(txn).rejects.toThrow('redis down');
    } finally {
      evalSpy?.mockRestore();
    }
    expect(await committedName(organization.id)).toBe('renamed');
  });

  it('has committed the write while publishing a key it wrote still hangs', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    const redis = redisClient();
    const realEval = redis.eval.bind(redis) as (...args: unknown[]) => Promise<unknown>;
    let release: () => void = () => {};
    let publishStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      publishStarted = resolve;
    });
    let evalSpy: ReturnType<typeof spyOn> | undefined;
    try {
      const txn = db.txn(async () => {
        await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
        evalSpy = spyOn(redis, 'eval').mockImplementation(((...args: unknown[]) => {
          if (!args.includes(key)) return realEval(...args);
          publishStarted();
          return new Promise((resolve) => {
            release = () => resolve(realEval(...args));
          });
        }) as typeof redis.eval);
      });
      await started;
      expect(await committedName(organization.id)).toBe('renamed');
      release();
      await txn;
    } finally {
      evalSpy?.mockRestore();
    }
  });

  const countedFor = (
    counter: { mock: { calls: Parameters<typeof telemetry.incrementCounter>[] } },
    name: string,
  ) =>
    counter.mock.calls
      .filter(([counted]) => counted === name)
      .map(([, , attributes]) => attributes.accessor);

  it('publishes a commit group in one eval and reports each key separately: published, large and skipped', async () => {
    const published = cacheKey('publishedProbe', Bun.randomUUIDv7());
    const large = cacheKey('largeProbe', Bun.randomUUIDv7());
    const skipped = cacheKey('skippedProbe', Bun.randomUUIDv7());
    const redis = redisClient();
    const evals = spyOn(redis, 'eval');
    const counter = spyOn(telemetry, 'incrementCounter');
    try {
      await db.txn(async () => {
        await fetchThroughCache(published, async () => 'small', 60);
        await fetchThroughCache(large, async () => 'x'.repeat(300 * 1024), 60);
        await fetchThroughCache(skipped, async () => 'stale', 60);
        await clearCacheKeysMatchingPattern(skipped);
        evals.mockClear();
        counter.mockClear();
      });
      expect(evals).toHaveBeenCalledTimes(1);
      expect(countedFor(counter, 'cache.publish.skipped')).toEqual(['skippedProbe']);
      expect(countedFor(counter, 'cache.value.large')).toEqual(['largeProbe']);
    } finally {
      evals.mockRestore();
      counter.mockRestore();
    }
    expect(await redis.get(published)).not.toBeNull();
    expect(await redis.get(large)).not.toBeNull();
    expect(await redis.get(skipped)).toBeNull();
  });

  it('clears a marked key and publishes a marked key recomputed after its write, in one eval', async () => {
    const cleared = cacheKey('clearedProbe', Bun.randomUUIDv7());
    const recomputed = cacheKey('recomputedProbe', Bun.randomUUIDv7());
    const redis = redisClient();
    await fetchThroughCache(cleared, async () => 'before', 60);
    await fetchThroughCache(recomputed, async () => 'before', 60);
    const evals = spyOn(redis, 'eval');
    const counter = spyOn(telemetry, 'incrementCounter');
    try {
      await db.txn(async () => {
        await markCacheWritten([cleared, recomputed]);
        await fetchThroughCache(recomputed, async () => 'y'.repeat(300 * 1024), 60);
        evals.mockClear();
        counter.mockClear();
      });
      expect(evals).toHaveBeenCalledTimes(1);
      expect(countedFor(counter, 'cache.publish.skipped')).toEqual([]);
      expect(countedFor(counter, 'cache.value.large')).toEqual(['recomputedProbe']);
    } finally {
      evals.mockRestore();
      counter.mockRestore();
    }
    expect(await redis.get(cleared)).toBeNull();
    expect(await fetchThroughCache(recomputed, async () => 'not read', 60)).toBe(
      'y'.repeat(300 * 1024),
    );
  });

  it('lists a space created in an organization the user owns', async () => {
    const { entity: user } = await createUser();
    const member = await createOrganizationUser({ role: 'owner' }, { user });
    expect((await findUserWithRelations(user.id))?.spaces).toHaveLength(0);
    const { entity: space } = await createSpace({}, { organization: member.context.organization });
    expect((await findUserWithRelations(user.id))?.spaces.map((s) => s.id)).toEqual([space.id]);
  });
});
