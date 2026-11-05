import { describe, expect, it } from 'bun:test';
import { createLock, db } from '@template/db';
import type { OpenTransaction } from '@template/db/clientTypes';
import { FIND_FOR_UPDATE_LOCK_SERVICE } from '@template/db/lock/acquireFindForUpdateLock';
import { findForUpdateLockIdentifier } from '@template/db/lock/findForUpdateLockIdentifier';
import { holdLockUntilSettled } from '@template/db/lock/holdLockUntilSettled';
import { getNextSeq } from '@template/db/test/factory';
import { gate } from '@template/db/test/gate';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const settles = (promise: Promise<unknown>, withinMs: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    sleep(withinMs).then(() => false),
  ]);

const lockOptions = () => ({
  service: 'with-lock-until-settled-test',
  identifier: `owner-${getNextSeq()}`,
  ttlMs: 2_000,
  heartbeatMs: 500,
});

const timedOut = () => new Error('timed out waiting for the lock');

const isFree = async (options: ReturnType<typeof lockOptions>) => {
  const probe = createLock(options);
  const acquired = await probe.acquire();
  if (acquired) await probe.release();
  return acquired;
};

describe('db.withLockUntilSettled', () => {
  it('requires a transaction', async () => {
    await expect(db.withLockUntilSettled(lockOptions(), async () => 'ran')).rejects.toThrow(
      'db.withLockUntilSettled() requires db.txn()',
    );
  });

  it('holds the lock after fn returns, until the transaction commits', async () => {
    const options = lockOptions();
    const fnReturned = gate();
    const commit = gate();

    const holding = db.txn(async () => {
      await db.withLockUntilSettled(options, async () => 'ran');
      fnReturned.open();
      await commit.opened;
    });
    await fnReturned.opened;

    expect(await isFree(options)).toBe(false);
    commit.open();
    await holding;
    expect(await isFree(options)).toBe(true);
  });

  it('releases the lock when the transaction rolls back', async () => {
    const options = lockOptions();
    const failure = db.txn(async () => {
      await db.withLockUntilSettled(options, async () => 'ran');
      throw new Error('roll back');
    });

    await expect(failure).rejects.toThrow('roll back');
    expect(await isFree(options)).toBe(true);
  });

  it('makes another transaction wait until the holder commits', async () => {
    const options = lockOptions();
    const fnReturned = gate();
    const commit = gate();
    const order: string[] = [];

    const holding = db.txn(async () => {
      await db.withLockUntilSettled(options, async () => order.push('first'));
      fnReturned.open();
      await commit.opened;
      order.push('first committed');
    });
    await fnReturned.opened;

    const waiting = db.txn(() =>
      db.withLockUntilSettled(options, async () => order.push('second'), { waitMs: 2_000 }),
    );
    const waitedForCommit = !(await settles(waiting, 300));
    commit.open();
    await Promise.all([holding, waiting]);

    expect(waitedForCommit).toBe(true);
    expect(order).toEqual(['first', 'first committed', 'second']);
  });

  it('throws the onTimeout error when the holder outlasts the wait, and holds nothing after', async () => {
    const options = lockOptions();
    const fnReturned = gate();
    const commit = gate();

    const holding = db.txn(async () => {
      await db.withLockUntilSettled(options, async () => 'ran');
      fnReturned.open();
      await commit.opened;
    });
    await fnReturned.opened;

    const waiting = db.txn(() =>
      db.withLockUntilSettled(options, async () => 'ran', { waitMs: 100, onTimeout: timedOut }),
    );
    await expect(waiting).rejects.toThrow('timed out waiting for the lock');

    commit.open();
    await holding;
    expect(await isFree(options)).toBe(true);
  });

  it('releases a lock whose acquisition finishes after the transaction already settled', async () => {
    const options = lockOptions();
    const outside = createLock(options);
    await outside.acquire();
    setTimeout(() => void outside.release(), 200);

    let late: Promise<unknown> = Promise.resolve();
    const failure = db.txn(async () => {
      late = db
        .withLockUntilSettled(options, async () => 'ran', { waitMs: 2_000 })
        .catch(() => null);
      await sleep(20);
      throw new Error('roll back');
    });
    await expect(failure).rejects.toThrow('roll back');
    await late;

    expect(await isFree(options)).toBe(true);
  });

  it('refuses a take on a transaction that has already settled, holding nothing', async () => {
    const options = lockOptions();
    const settledTransaction = {
      heldLocks: new Map(),
      finallyFns: [],
      settled: true,
    } as unknown as OpenTransaction;

    await expect(holdLockUntilSettled(settledTransaction, options)).rejects.toThrow(
      'transaction settled before taking lock',
    );
    expect(await isFree(options)).toBe(true);
  });

  it('takes the same key again in one transaction without waiting on itself', async () => {
    const options = lockOptions();
    const started = Date.now();

    const result = await db.txn(async () => {
      await db.withLockUntilSettled(options, async () => 'first', { waitMs: 1_000 });
      return db.txn(() =>
        db.withLockUntilSettled(options, async () => 'second', { waitMs: 1_000 }),
      );
    });

    expect(result).toBe('second');
    expect(Date.now() - started).toBeLessThan(900);
  });

  it('runs a take from inside a holder straight through', async () => {
    const options = lockOptions();

    const result = await db.txn(() =>
      db.withLockUntilSettled(options, () =>
        db.withLockUntilSettled(options, async () => 'nested', { waitMs: 1_000 }),
      ),
    );

    expect(result).toBe('nested');
  });

  it('runs parallel holders in one transaction one at a time', async () => {
    const options = lockOptions();
    const events: string[] = [];
    const hold = (name: string) =>
      db.withLockUntilSettled(options, async () => {
        events.push(`${name} start`);
        await sleep(50);
        events.push(`${name} end`);
      });

    await db.txn(() => Promise.all([hold('a'), hold('b')]));

    expect(events).toEqual(['a start', 'a end', 'b start', 'b end']);
  });

  it('a failing holder does not stop the next holder of the key', async () => {
    const options = lockOptions();

    const outcomes = await db.txn(() =>
      Promise.allSettled([
        db.withLockUntilSettled(options, async () => {
          throw new Error('first failed');
        }),
        db.withLockUntilSettled(options, async () => 'second ran'),
      ]),
    );

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'fulfilled']);
    expect(await isFree(options)).toBe(true);
  });

  it('a queued holder does not run once a sibling has rolled the transaction back', async () => {
    const options = lockOptions();
    const firstRunning = gate();
    const firstDone = gate();
    let queuedRan = false;
    let first: Promise<unknown> = Promise.resolve();
    let queued: Promise<unknown> = Promise.resolve();

    const failure = db.txn(async () => {
      first = db.withLockUntilSettled(options, async () => {
        firstRunning.open();
        await firstDone.opened;
      });
      queued = db.withLockUntilSettled(options, async () => {
        queuedRan = true;
      });
      await firstRunning.opened;
      throw new Error('roll back');
    });
    await expect(failure).rejects.toThrow('roll back');
    expect(await isFree(options)).toBe(true);

    firstDone.open();
    const [, queuedOutcome] = await Promise.allSettled([first, queued]);
    expect(queuedOutcome).toMatchObject({ status: 'rejected' });
    expect(String((queuedOutcome as PromiseRejectedResult).reason)).toContain(
      'transaction settled while waiting for lock',
    );
    expect(queuedRan).toBe(false);
  });
  describe('sharing keys with a findForUpdate lock set', () => {
    const emails = () =>
      [`settled-set-a-${getNextSeq()}@test.com`, `settled-set-b-${getNextSeq()}@test.com`] as const;
    const fenceOptions = (email: string) => ({
      service: FIND_FOR_UPDATE_LOCK_SERVICE,
      identifier: findForUpdateLockIdentifier('User', { email }),
      ttlMs: 2_000,
      heartbeatMs: 500,
    });

    it('joins a key a findForUpdate set in the same transaction already holds', async () => {
      const [a, b] = emails();

      const result = await db.txn(async () => {
        await db.findForUpdate('User', { email: { in: [a, b] } }, { upserting: true });
        return db.withLockUntilSettled(fenceOptions(b), async () => 'joined', { waitMs: 0 });
      });

      expect(result).toBe('joined');
      expect(await isFree(fenceOptions(a))).toBe(true);
      expect(await isFree(fenceOptions(b))).toBe(true);
    });

    it('a findForUpdate set joins a key withLockUntilSettled already holds and takes only the rest', async () => {
      const [a, b] = emails();
      const held = gate();
      const commit = gate();

      const holding = db.txn(async () => {
        await db.withLockUntilSettled(fenceOptions(a), async () => {
          const rows = await db.findForUpdate(
            'User',
            { email: { in: [a, b] } },
            { upserting: true, waitMs: 0 },
          );
          expect(rows).toEqual([]);
        });
        held.open();
        await commit.opened;
      });
      await held.opened;

      expect(await isFree(fenceOptions(a))).toBe(false);
      expect(await isFree(fenceOptions(b))).toBe(false);
      commit.open();
      await holding;
      expect(await isFree(fenceOptions(a))).toBe(true);
      expect(await isFree(fenceOptions(b))).toBe(true);
    });
  });
});
