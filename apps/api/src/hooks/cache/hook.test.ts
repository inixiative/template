import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  cache,
  cacheKey,
  checkCache,
  clearHookRegistry,
  clearKey,
  db,
  fetchOne,
  getRedisClient,
  markCacheWritten,
} from '@template/db';
import type { Organization, OrganizationUser } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { loadTokenContext } from '#/lib/context/loadTokenContext';
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
  beforeAll(() => {
    registerClearCacheHook();
    registerSoftDeleteCascadeHook();
  });
  afterAll(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('sees the transaction’s own write on a key that was cached before it', async () => {
    const { entity: organization } = await createOrganization();
    await fetchOne('organization', organization.id);
    let inside: string | undefined;
    await db.txn(async () => {
      await db.organization.update({
        where: { id: organization.id },
        data: { name: 'written-in-txn' },
      });
      inside = (await fetchOne<Organization>('organization', organization.id))?.name;
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
      await clearKey(cacheKey('organization', organization.id));
      await fetchOne('organization', organization.id);
    });
    expect((await fetchOne<Organization>('organization', organization.id))?.name).toBe(
      organization.name,
    );
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
      await clearKey(cacheKey('user', user.id, ['organizationUsers']));
      await clearKey(memberKeyOf(member.entity));
      await findUserWithRelations(user.id);
    });
    expect((await findUserWithRelations(user.id))?.organizationUsers[0]?.role).toBe('viewer');
    expect(
      (
        await fetchOne<OrganizationUser>('organizationUser', {
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
    await loadTokenContext(keyHash);
    await rollingBack(async () => {
      await db.organizationUser.update({
        where: { id: member.entity.id },
        data: { role: 'owner' },
      });
      await clearKey(memberKeyOf(member.entity));
      await loadTokenContext(keyHash);
    });
    const after = await loadTokenContext(keyHash);
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
      const sibling = cache(key, async () => {
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
      after = (await fetchOne<Organization>('organization', organization.id))?.name;
    });
    expect(after).toBe('written-by-sibling');
  });
  it('publishes a value it computed when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await db.txn(async () => {
      await fetchOne('organization', organization.id);
      expect(await cachedName(key)).toBeUndefined();
    });
    expect(await cachedName(key)).toBe(organization.name);
  });

  it('publishes the value it recomputed after its own write when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await fetchOne('organization', organization.id);
    await db.txn(async () => {
      await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
      await fetchOne('organization', organization.id);
    });
    expect(await cachedName(key)).toBe('renamed');
  });

  it('clears a key it wrote and did not read again when it commits', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await fetchOne('organization', organization.id);
    await db.txn(async () => {
      await db.organization.update({ where: { id: organization.id }, data: { name: 'renamed' } });
    });
    expect(await cachedName(key)).toBeUndefined();
  });

  it('does not publish a value computed before another clear of the key landed', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id);
    await db.txn(async () => {
      await fetchOne('organization', organization.id);
      await clearKey(key);
    });
    expect(await cachedName(key)).toBeUndefined();
  });
  it('treats every key under a written pattern as written, and leaves none of them stale after commit', async () => {
    const { entity: organization } = await createOrganization();
    const key = cacheKey('organization', organization.id, ['summary']);
    await cache(key, async () => 'before');
    let inside: string | undefined;
    await db.txn(async () => {
      await markCacheWritten([cacheKey('organization', organization.id, [], true)]);
      inside = await cache(key, async () => 'after');
    });
    expect(inside).toBe('after');
    const check = await checkCache<string>(key);
    expect('value' in check ? check.value : undefined).not.toBe('before');
  });
  it('publishes a key whose data holds a star as itself, clearing no other key', async () => {
    const mine = cacheKey('User', 'a*b@example.com', ['email']);
    const other = cacheKey('User', 'aXb@example.com', ['email']);
    await cache(other, async () => 'other');
    await db.txn(async () => {
      await cache(mine, async () => 'mine');
    });
    const read = async (key: string) => {
      const check = await checkCache<string>(key);
      return 'value' in check ? check.value : undefined;
    };
    expect(await read(other)).toBe('other');
    expect(await read(mine)).toBe('mine');
  });
  it('neither reads nor writes the shared cache under withDeleted', async () => {
    const key = cacheKey('organization', 'withDeleted-probe');
    await cache(key, async () => 'live');
    const read = await db.withDeleted(() => cache(key, async () => 'tombstone-inclusive'));
    expect(read).toBe('tombstone-inclusive');
    const check = await checkCache<string>(key);
    expect('value' in check ? check.value : undefined).toBe('live');
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
    const evalSpy = spyOn(getRedisClient(), 'eval').mockRejectedValueOnce(new Error('redis down'));
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
  it('lists a space created in an organization the user owns', async () => {
    const { entity: user } = await createUser();
    const member = await createOrganizationUser({ role: 'owner' }, { user });
    expect((await findUserWithRelations(user.id))?.spaces).toHaveLength(0);
    const { entity: space } = await createSpace({}, { organization: member.context.organization });
    expect((await findUserWithRelations(user.id))?.spaces.map((s) => s.id)).toEqual([space.id]);
  });
});
