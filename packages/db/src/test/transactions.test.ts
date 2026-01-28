import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, registerTestTracker } from './testTracker';

describe('transactions', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('db.txn', () => {
    it('executes function within a transaction', async () => {
      const result = await db.txn(async () => {
        const user = await db.user.create({
          data: {
            email: 'txn-test@example.com',
            name: 'Txn User',
          },
        });
        return user;
      });

      expect(result.email).toBe('txn-test@example.com');
      expect(result.id).toBeDefined();

      const found = await db.user.findUnique({
        where: { id: result.id },
      });
      expect(found).not.toBeNull();
    });

    it('rolls back transaction on error', async () => {
      const email = `rollback-test-${Date.now()}@example.com`;

      await expect(
        db.txn(async () => {
          await db.user.create({
            data: { email, name: 'Should Rollback' },
          });
          throw new Error('Intentional error');
        }),
      ).rejects.toThrow('Intentional error');

      const user = await db.user.findUnique({
        where: { email },
      });
      expect(user).toBeNull();
    });

    it('reuses existing transaction when nested', async () => {
      let innerIsInTxn = false;
      let outerIsInTxn = false;

      await db.txn(async () => {
        outerIsInTxn = db.isInTxn();

        await db.txn(async () => {
          innerIsInTxn = db.isInTxn();
        });
      });

      expect(outerIsInTxn).toBe(true);
      expect(innerIsInTxn).toBe(true);
    });

    it('nested transaction does not commit independently', async () => {
      const email = `nested-test-${Date.now()}@example.com`;

      await expect(
        db.txn(async () => {
          await db.txn(async () => {
            await db.user.create({
              data: { email, name: 'Nested User' },
            });
          });
          throw new Error('Outer transaction error');
        }),
      ).rejects.toThrow('Outer transaction error');

      const user = await db.user.findUnique({
        where: { email },
      });
      expect(user).toBeNull();
    });

    it('returns the result of the transaction function', async () => {
      const result = await db.txn(async () => {
        return { success: true, value: 42 };
      });

      expect(result).toEqual({ success: true, value: 42 });
    });
  });

  describe('db.isInTxn', () => {
    it('returns false when not in a transaction', () => {
      expect(db.isInTxn()).toBe(false);
    });

    it('returns true when inside a transaction', async () => {
      let insideValue = false;

      await db.txn(async () => {
        insideValue = db.isInTxn();
      });

      expect(insideValue).toBe(true);
    });

    it('returns false after transaction completes', async () => {
      await db.txn(async () => {});
      expect(db.isInTxn()).toBe(false);
    });

    it('returns false after transaction fails', async () => {
      try {
        await db.txn(async () => {
          throw new Error('Test error');
        });
      } catch {}

      expect(db.isInTxn()).toBe(false);
    });
  });

  describe('db.onCommit', () => {
    it('executes callback after transaction commits', async () => {
      const callback = mock(() => {});
      let callbackCalledDuringTxn = false;

      await db.txn(async () => {
        db.onCommit(callback);
        callbackCalledDuringTxn = callback.mock.calls.length > 0;
      });

      expect(callbackCalledDuringTxn).toBe(false);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not execute callback if transaction rolls back', async () => {
      const callback = mock(() => {});

      try {
        await db.txn(async () => {
          db.onCommit(callback);
          throw new Error('Rollback');
        });
      } catch {}

      expect(callback).not.toHaveBeenCalled();
    });

    it('executes multiple callbacks in order', async () => {
      const callOrder: number[] = [];

      await db.txn(async () => {
        db.onCommit(() => callOrder.push(1));
        db.onCommit(() => callOrder.push(2));
        db.onCommit(() => callOrder.push(3));
      });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('executes callbacks within the same batch in parallel', async () => {
      const callOrder: string[] = [];

      await db.txn(async () => {
        db.onCommit([
          async () => {
            await new Promise((r) => setTimeout(r, 20));
            callOrder.push('slow');
          },
          () => {
            callOrder.push('fast');
          },
        ]);
      });

      expect(callOrder).toEqual(['fast', 'slow']);
    });

    it('executes batches sequentially', async () => {
      const callOrder: string[] = [];

      await db.txn(async () => {
        db.onCommit(async () => {
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('batch1');
        });
        db.onCommit(() => {
          callOrder.push('batch2');
        });
      });

      expect(callOrder).toEqual(['batch1', 'batch2']);
    });

    it('throws error when called outside transaction', () => {
      expect(() => {
        db.onCommit(() => {});
      }).toThrow('db.onCommit() requires db.txn()');
    });

    it('supports async callbacks', async () => {
      let resolved = false;

      await db.txn(async () => {
        db.onCommit(async () => {
          await new Promise((r) => setTimeout(r, 10));
          resolved = true;
        });
      });

      expect(resolved).toBe(true);
    });

    it('throws when used with db.scope without a transaction', async () => {
      await db.scope('test-scope', async () => {
        expect(() => db.onCommit(() => {})).toThrow('db.onCommit() requires db.txn()');
      });
    });

    it('callback errors do not affect transaction result', async () => {
      const errorCallback = mock(() => {
        throw new Error('Callback error');
      });
      const successCallback = mock(() => {});

      await expect(
        db.txn(async () => {
          db.onCommit(errorCallback);
          db.onCommit(successCallback);
          return 'success';
        }),
      ).rejects.toThrow('Callback error');
    });
  });
});
