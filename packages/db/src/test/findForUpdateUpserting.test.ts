import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, FindForUpdateLockTimeoutError } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

const findOrCreateUser = (email: string) =>
  db.txn(async () => {
    const [existing] = await db.findForUpdate<User>('User', { email }, { upserting: true });
    if (existing) return { user: existing, created: false };
    // Widen the gap between the empty read and the insert so an unfenced race is certain.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const user = await db.user.create({ data: { email, name: 'Upserting' } });
    return { user, created: true };
  });

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

describe('db.findForUpdate upserting mode', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('serializes concurrent create-if-missing on one key into exactly one row', async () => {
    const email = `upserting-race-${getNextSeq()}@test.com`;
    const results = await db.parallel(Array.from({ length: 5 }, () => () => findOrCreateUser(email)));

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.user.id)).size).toBe(1);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it('releases the lock after commit', async () => {
    const email = `upserting-commit-${getNextSeq()}@test.com`;
    await findOrCreateUser(email);

    const started = Date.now();
    const again = await findOrCreateUser(email);
    expect(again.created).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('releases the lock after a rollback', async () => {
    const email = `upserting-rollback-${getNextSeq()}@test.com`;
    await expect(
      db.txn(async () => {
        await db.findForUpdate('User', { email }, { upserting: true });
        throw new Error('Intentional rollback');
      }),
    ).rejects.toThrow('Intentional rollback');

    const started = Date.now();
    const result = await db.txn(() => db.findForUpdate('User', { email }, { upserting: true, waitMs: 100 }));
    expect(result).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('throws FindForUpdateLockTimeoutError when the holder outlasts the wait', async () => {
    const email = `upserting-timeout-${getNextSeq()}@test.com`;
    let releaseHolder: () => void = () => {};
    const holderReleased = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    let signalHeld: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      signalHeld = resolve;
    });

    const [holder, waiter] = await db.parallel<unknown>(
      [
        () =>
          db.txn(async () => {
            await db.findForUpdate('User', { email }, { upserting: true });
            signalHeld();
            await holderReleased;
          }),
        async () => {
          await held;
          try {
            return await db.txn(() => db.findForUpdate('User', { email }, { upserting: true, waitMs: 150 }));
          } finally {
            releaseHolder();
          }
        },
      ],
      { resolution: 'allSettled' },
    );

    expect(holder?.status).toBe('fulfilled');
    expect(waiter?.status).toBe('rejected');
    expect((waiter as PromiseRejectedResult).reason).toBeInstanceOf(FindForUpdateLockTimeoutError);
  });

  it('does not wait on itself when the same transaction fences a key twice', async () => {
    const email = `upserting-reentrant-${getNextSeq()}@test.com`;
    const rows = await withTimeout(
      db.txn(async () => {
        await db.findForUpdate('User', { email }, { upserting: true, waitMs: 200 });
        await db.txn(() => db.findForUpdate('User', { email }, { upserting: true, waitMs: 200 }));
        return db.findForUpdate('User', { email }, { upserting: true, waitMs: 200 });
      }),
      2_000,
    );
    expect(rows).toEqual([]);
  });

  it('keys the lock on sorted entries, so where-object order does not matter', async () => {
    const { id: userId, email } = await db.txn(() =>
      db.user.create({ data: { email: `upserting-order-${getNextSeq()}@test.com`, name: 'Order' } }),
    );
    const other = await db.parallel<unknown>(
      [
        () =>
          db.txn(async () => {
            await db.findForUpdate('User', { id: userId, email }, { upserting: true });
            await new Promise((resolve) => setTimeout(resolve, 300));
          }),
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return db.txn(() => db.findForUpdate('User', { email, id: userId }, { upserting: true, waitMs: 100 }));
        },
      ],
      { resolution: 'allSettled' },
    );
    expect((other[1] as PromiseRejectedResult).reason).toBeInstanceOf(FindForUpdateLockTimeoutError);
  });

  it.each([
    ['an array', { email: ['a@test.com', 'b@test.com'] }],
    ['an in-list', { email: { in: ['a@test.com'] } }],
    ['an operator object', { email: { contains: 'a' } }],
    ['null', { email: null }],
    ['undefined', { email: undefined }],
    ['an empty where', {}],
  ])('rejects %s', async (_label, where) => {
    await expect(
      db.txn(() => db.findForUpdate('User', where as Record<string, unknown>, { upserting: true })),
    ).rejects.toThrow(/db\.findForUpdate\(\)/);
  });

  it('leaves non-upserting findForUpdate unchanged', async () => {
    const rows = await db.txn(() => db.findForUpdate('User', { email: { in: [] } }));
    expect(rows).toEqual([]);
  });
});
