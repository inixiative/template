import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  cache,
  cacheKey,
  checkCache,
  clearKey,
  db,
  fetchOne,
  markCacheWritten,
  unregisterDbHook,
} from '@template/db';
import type { Organization, OrganizationUser } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
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
  beforeAll(() => registerClearCacheHook());
  afterAll(async () => {
    unregisterDbHook('clearCache');
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
      await clearKey(cacheKey('User', user.id, ['relations']));
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
});
