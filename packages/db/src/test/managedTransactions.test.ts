import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { clearHookRegistry, DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { readPrismaTransaction } from '@template/db/extensions/prismaTransaction';
import { Prisma } from '@template/db/generated/client/client';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

const nextEmail = (label: string) => `${label}-${getNextSeq()}-${Date.now()}@test.com`;

describe('managed transactions', () => {
  beforeEach(() => {
    clearHookRegistry();
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  describe('unmanaged transactions', () => {
    it('rejects a hooked mutation inside a raw $transaction instead of committing it independently', async () => {
      const email = nextEmail('unmanaged');

      await expect(
        db.raw.$transaction(async (transactionClient) => {
          await transactionClient.user.create({ data: { email, name: 'Unmanaged' } });
        }),
      ).rejects.toThrow('transaction that db.txn() did not open');

      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    });

    it('does not let a write survive the rollback of the transaction that issued it', async () => {
      const email = nextEmail('unmanaged-rollback');

      await expect(
        db.raw.$transaction(async (transactionClient) => {
          await transactionClient.user.create({ data: { email, name: 'Should Roll Back' } });
          throw new Error('Intentional error');
        }),
      ).rejects.toThrow();

      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    });

    it('rejects a hooked mutation inside a batch $transaction', async () => {
      const email = nextEmail('batch');

      await expect(db.raw.$transaction([db.raw.user.create({ data: { email, name: 'Batched' } })])).rejects.toThrow(
        'transaction that db.txn() did not open',
      );

      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  describe('mutations with no transaction', () => {
    it('runs the write and its hooks atomically through the txn the proxy opens at the call site', async () => {
      const email = nextEmail('reissued');
      let hookSawTransaction = false;

      registerDbHook('reissued-hook', 'User', HookTiming.after, [DbAction.create], async ({ result }) => {
        hookSawTransaction = db.isInTxn();
        await db.session.findMany({ where: { userId: (result as { id: string }).id } });
      });

      const user = await db.user.create({ data: { email, name: 'Reissued' } });

      expect(user.email).toBe(email);
      expect(hookSawTransaction).toBe(true);
      expect(await db.user.findUnique({ where: { email } })).not.toBeNull();
    });

    it('rolls back the write when its after hook throws', async () => {
      const email = nextEmail('reissued-failing-hook');

      registerDbHook('reissued-failing-hook', 'User', HookTiming.after, [DbAction.create], async () => {
        throw new Error('hook rejected the write');
      });

      await expect((async () => db.user.create({ data: { email, name: 'Doomed' } }))()).rejects.toThrow(
        'hook rejected the write',
      );

      expect(await db.user.findUnique({ where: { email } })).toBeNull();
    });

    it('goes straight through for a hookless model, keeping the nested-write guard', async () => {
      clearHookRegistry();

      await expect(
        db.user.create({
          data: {
            email: nextEmail('hookless-nested'),
            name: 'Hookless Nested',
            sessions: { create: [{ token: `hookless-${getNextSeq()}-${Date.now()}`, expiresAt: new Date() }] },
          },
        }),
      ).rejects.toThrow('skips Session hooks');

      const email = nextEmail('hookless-plain');
      const user = await db.user.create({ data: { email, name: 'Hookless Plain' } });
      expect(user.email).toBe(email);

      registerTestTracker();
      await db.user.deleteMany({ where: { id: user.id } });
    });

    it('lets db.raw nest writes — the raw opt-out covers the guard too', async () => {
      const user = await db.raw.user.create({
        data: {
          email: nextEmail('raw-nested'),
          name: 'Raw Nested',
          sessions: { create: [{ token: `raw-nested-${getNextSeq()}-${Date.now()}`, expiresAt: new Date() }] },
        },
      });

      expect(await db.session.findFirst({ where: { userId: user.id } })).not.toBeNull();

      await db.session.deleteMany({ where: { userId: user.id } });
      await db.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe('batch rollback atomicity', () => {
    it('rolls back hook side-effect writes together with the mutations that triggered them', async () => {
      const firstEmail = nextEmail('atomic-first');
      const secondEmail = nextEmail('atomic-second');

      registerDbHook('atomic-side-effect', 'User', HookTiming.after, [DbAction.create], async ({ result }) => {
        await db.session.create({
          data: {
            userId: (result as { id: string }).id,
            token: `atomic-${getNextSeq()}-${Date.now()}`,
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
      });

      await expect(
        db.txn(async () => {
          await db.user.create({ data: { email: firstEmail, name: 'First' } });
          await db.user.create({ data: { email: secondEmail, name: 'Second' } });
          throw new Error('Intentional error');
        }),
      ).rejects.toThrow('Intentional error');

      expect(await db.user.findUnique({ where: { email: firstEmail } })).toBeNull();
      expect(await db.user.findUnique({ where: { email: secondEmail } })).toBeNull();
      expect(await db.session.count()).toBe(0);
    });

    it('writes the hook side effect on the same transaction as the mutation', async () => {
      const email = nextEmail('atomic-committed');

      registerDbHook('atomic-visible', 'User', HookTiming.after, [DbAction.create], async ({ result }) => {
        await db.session.create({
          data: {
            userId: (result as { id: string }).id,
            token: `visible-${getNextSeq()}-${Date.now()}`,
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
      });

      const user = await db.txn(() => db.user.create({ data: { email, name: 'Committed' } }));

      expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    });
  });

  describe('onCommit registered from a hook', () => {
    it('fires after the transaction commits and never before', async () => {
      const callback = mock(() => {});
      let firedBeforeCommit = false;

      registerDbHook('oncommit-hook', 'User', HookTiming.after, [DbAction.create], async () => {
        db.onCommit(callback);
      });

      await db.txn(async () => {
        await db.user.create({ data: { email: nextEmail('oncommit'), name: 'OnCommit' } });
        firedBeforeCommit = callback.mock.calls.length > 0;
      });

      expect(firedBeforeCommit).toBe(false);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not fire when the transaction rolls back', async () => {
      const callback = mock(() => {});

      registerDbHook('oncommit-rollback-hook', 'User', HookTiming.after, [DbAction.create], async () => {
        db.onCommit(callback);
      });

      await expect(
        db.txn(async () => {
          await db.user.create({ data: { email: nextEmail('oncommit-rollback'), name: 'Rolled Back' } });
          throw new Error('Intentional error');
        }),
      ).rejects.toThrow('Intentional error');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

// If this fails, Prisma moved or renamed the executing-transaction marker that db.txn()'s
// registration handshake and the mutation extension both read. Re-point
// readPrismaTransaction() in extensions/prismaTransaction.ts at the new location; do not
// fall back to db.isInTxn(), which is what this replaced.
describe('Prisma internal transaction marker (db.txn registration depends on it)', () => {
  it('exposes the interactive transaction id on __internalParams, with a distinct id per transaction', async () => {
    const observedTransactions: unknown[] = [];

    const probeClient = db.raw.$extends(
      Prisma.defineExtension({
        name: 'transactionMarkerProbe',
        query: {
          $allModels: {
            async findFirst(params) {
              observedTransactions.push(readPrismaTransaction(params));
              return params.query(params.args);
            },
          },
        },
      }),
    );

    await probeClient.$transaction((transactionClient) => transactionClient.user.findFirst());
    await probeClient.$transaction((transactionClient) => transactionClient.user.findFirst());
    await probeClient.user.findFirst();

    const [firstTransaction, secondTransaction, noTransaction] = observedTransactions as (
      | {
          kind: string;
          id: string;
        }
      | undefined
    )[];

    expect(firstTransaction?.kind).toBe('itx');
    expect(typeof firstTransaction?.id).toBe('string');
    expect(secondTransaction?.kind).toBe('itx');
    expect(secondTransaction?.id).not.toBe(firstTransaction?.id);
    expect(noTransaction).toBeUndefined();
  });
});
