import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

describe('db.onFinally', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('throws outside a transaction', () => {
    expect(() => db.onFinally(() => {})).toThrow('db.onFinally() requires db.txn()');
  });

  it('runs after the commit has landed', async () => {
    const email = `finally-commit-${getNextSeq()}@test.com`;
    let seenAfterCommit: unknown = 'not run';

    await db.txn(async () => {
      await db.user.create({ data: { email, name: 'Finally Commit' } });
      db.onFinally(async () => {
        seenAfterCommit = await db.raw.user.findUnique({ where: { email } });
      });
    });

    expect(seenAfterCommit).toMatchObject({ email });
  });

  it('runs on rollback and the rollback error still propagates', async () => {
    const email = `finally-rollback-${getNextSeq()}@test.com`;
    let seenAfterRollback: unknown = 'not run';

    await expect(
      db.txn(async () => {
        await db.user.create({ data: { email, name: 'Finally Rollback' } });
        db.onFinally(async () => {
          seenAfterRollback = await db.raw.user.findUnique({ where: { email } });
        });
        throw new Error('Intentional rollback');
      }),
    ).rejects.toThrow('Intentional rollback');

    expect(seenAfterRollback).toBeNull();
  });

  it('runs every callback when one throws, without masking the result', async () => {
    const calls: string[] = [];
    const result = await db.txn(async () => {
      db.onFinally([
        () => {
          calls.push('first');
          throw new Error('finally failure');
        },
        () => {
          calls.push('second');
        },
      ]);
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(calls).toEqual(['first', 'second']);
  });

  it('runs before the on-commit callbacks and does not wait for them', async () => {
    const order: string[] = [];
    await db.txn(async () => {
      db.onCommit(async () => {
        order.push('commit:start');
        await new Promise((resolve) => setTimeout(resolve, 50));
        order.push('commit:end');
      });
      db.onFinally(() => {
        order.push('finally');
      });
    });

    expect(order).toEqual(['finally', 'commit:start', 'commit:end']);
  });

  it('registers on the outermost transaction from a nested db.txn', async () => {
    const order: string[] = [];
    await db.txn(async () => {
      await db.txn(async () => {
        db.onFinally(() => {
          order.push('inner finally');
        });
      });
      order.push('outer body done');
    });

    expect(order).toEqual(['outer body done', 'inner finally']);
  });
});
