import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, FindForUpdateLockTimeoutError } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { getRedisClient } from '@template/db/redis/client';
import { createUser } from '@template/db/test/factories';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

const findOrCreateUser = (email: string, model = 'User') =>
  db.txn(async () => {
    const [existing] = await db.findForUpdate<User>(model, { email }, { upserting: true });
    if (existing) return { user: existing, created: false };
    // Widen the gap between the empty read and the insert so an unfenced race is certain.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const { entity: user } = await createUser({ email, name: 'Upserting' });
    return { user, created: true };
  });

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);

describe('db.findForUpdate upserting mode', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('serializes concurrent create-if-missing on one key into exactly one row', async () => {
    const email = `upserting-race-${getNextSeq()}@test.com`;
    const results = await db.parallel(
      Array.from({ length: 5 }, () => () => findOrCreateUser(email)),
    );

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.user.id)).size).toBe(1);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it('serializes model and accessor aliases for the same missing row', async () => {
    const email = `upserting-alias-${getNextSeq()}@test.com`;
    const results = await db.parallel([
      () => findOrCreateUser(email, 'User'),
      () => findOrCreateUser(email, 'user'),
    ]);
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
    const result = await db.txn(() =>
      db.findForUpdate('User', { email }, { upserting: true, waitMs: 100 }),
    );
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
            return await db.txn(() =>
              db.findForUpdate('User', { email }, { upserting: true, waitMs: 150 }),
            );
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
    const {
      entity: { id: userId, email },
    } = await db.txn(() =>
      createUser({ email: `upserting-order-${getNextSeq()}@test.com`, name: 'Order' }),
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
          return db.txn(() =>
            db.findForUpdate('User', { email, id: userId }, { upserting: true, waitMs: 100 }),
          );
        },
      ],
      { resolution: 'allSettled' },
    );
    expect((other[1] as PromiseRejectedResult).reason).toBeInstanceOf(
      FindForUpdateLockTimeoutError,
    );
  });

  it.each([
    ['an array', { email: ['a@test.com', 'b@test.com'] }],
    ['two listed fields', { email: { in: ['a@test.com'] }, name: { in: ['A'] } }],
    [
      'three listed fields',
      { id: { in: ['x'] }, email: { in: ['a@test.com'] }, name: { in: ['A'] } },
    ],
    ['a list inside an in-list', { email: { in: [['a@test.com']] } }],
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

  describe('fencing a batch with one listed field', () => {
    const emails = (label: string, count: number) =>
      Array.from({ length: count }, () => `upserting-${label}-${getNextSeq()}@test.com`);

    const gate = () => {
      let open: () => void = () => {};
      const opened = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { open, opened };
    };

    const lockKeys = () => getRedisClient().keys('*find-for-update:User:*');

    const holdWhile = (where: Record<string, unknown>) => {
      const held = gate();
      const release = gate();
      const done = db.txn(async () => {
        await db.findForUpdate('User', where, { upserting: true });
        held.open();
        await release.opened;
      });
      return { held: held.opened, release: release.open, done };
    };

    const fence = (where: Record<string, unknown>, waitMs: number) =>
      db.txn(() => db.findForUpdate('User', where, { upserting: true, waitMs }));

    it('locks each listed value under its own key, the same key a single-row fence takes', async () => {
      const list = emails('own-keys', 3);
      const before = new Set(await lockKeys());
      const batch = holdWhile({ email: { in: list } });
      await batch.held;

      expect((await lockKeys()).filter((key) => !before.has(key))).toHaveLength(3);
      for (const email of list)
        await expect(fence({ email }, 50)).rejects.toBeInstanceOf(FindForUpdateLockTimeoutError);

      batch.release();
      await batch.done;
      expect((await lockKeys()).filter((key) => !before.has(key))).toHaveLength(0);
      for (const email of list) await expect(fence({ email }, 0)).resolves.toEqual([]);
    });

    it('waits on a single-row holder of any one of its values', async () => {
      const [taken, free] = emails('waits', 2) as [string, string];
      const single = holdWhile({ email: taken });
      await single.held;

      await expect(fence({ email: { in: [free, taken] } }, 150)).rejects.toBeInstanceOf(
        FindForUpdateLockTimeoutError,
      );

      single.release();
      await single.done;
    });

    it('takes none of its values while one is held, so the rest stay free for others', async () => {
      const [taken, free] = emails('all-or-none', 2) as [string, string];
      const single = holdWhile({ email: taken });
      await single.held;

      const batch = fence({ email: { in: [free, taken] } }, 300);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await expect(fence({ email: free }, 0)).resolves.toEqual([]);
      await expect(batch).rejects.toBeInstanceOf(FindForUpdateLockTimeoutError);

      single.release();
      await single.done;
    });

    it('contends on the whole key: the same listed value beside another fixed field is another row', async () => {
      const [shared, mine] = emails('complex', 2) as [string, string];
      const batch = holdWhile({ email: { in: [shared, mine] }, name: 'Batch' });
      await batch.held;

      await expect(fence({ email: shared, name: 'Other' }, 0)).resolves.toEqual([]);
      await expect(fence({ email: shared, name: 'Batch' }, 100)).rejects.toBeInstanceOf(
        FindForUpdateLockTimeoutError,
      );

      batch.release();
      await batch.done;
    });

    it('lets exactly one of three fields list values, in any position', async () => {
      const [a, b] = emails('three-fields', 2) as [string, string];
      await expect(fence({ email: { in: [a, b] }, name: 'N', id: 'fixed-id' }, 0)).resolves.toEqual(
        [],
      );
      await expect(
        fence({ email: a, name: { in: ['N', 'M'] }, id: 'fixed-id' }, 0),
      ).resolves.toEqual([]);
      await expect(fence({ email: a, name: 'N', id: { in: ['i1', 'i2'] } }, 0)).resolves.toEqual(
        [],
      );
    });

    it('refuses two or three listed fields before taking any lock', async () => {
      const [a] = emails('many-lists', 1) as [string];
      const before = (await lockKeys()).length;

      await expect(fence({ email: { in: [a] }, name: { in: ['N'] } }, 0)).rejects.toThrow(
        /only one field may list values/,
      );
      await expect(
        fence({ id: { in: ['i'] }, email: { in: [a] }, name: { in: ['N'] } }, 0),
      ).rejects.toThrow(/only one field may list values/);
      expect((await lockKeys()).length).toBe(before);
    });

    it('takes no lock for an empty list, which locks nothing', async () => {
      const before = (await lockKeys()).length;
      await expect(fence({ email: { in: [] } }, 0)).resolves.toEqual([]);
      expect((await lockKeys()).length).toBe(before);
    });

    it('re-enters a value this transaction already holds and acquires only the rest', async () => {
      const [first, rest] = emails('reentrant', 2) as [string, string];
      const rows = await withTimeout(
        db.txn(async () => {
          await db.findForUpdate('User', { email: first }, { upserting: true, waitMs: 200 });
          return db.findForUpdate(
            'User',
            { email: { in: [first, rest] } },
            { upserting: true, waitMs: 200 },
          );
        }),
        2_000,
      );
      expect(rows).toEqual([]);
    });

    it('serializes a batch create against single-row creates of the same values into one row each', async () => {
      const list = emails('batch-race', 4);
      const results = await db.parallel<unknown>([
        () =>
          db.txn(async () => {
            const found = await db.findForUpdate<User>(
              'User',
              { email: { in: list } },
              { upserting: true },
            );
            const have = new Set(found.map((user) => user.email));
            await new Promise((resolve) => setTimeout(resolve, 50));
            for (const email of list.filter((value) => !have.has(value)))
              await createUser({ email, name: 'Batch' });
          }),
        ...list.map((email) => () => findOrCreateUser(email)),
      ]);

      expect(results).toHaveLength(list.length + 1);
      for (const email of list) expect(await db.user.count({ where: { email } })).toBe(1);
    });
  });
});
