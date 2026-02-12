import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

describe('scope', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('db.scope', () => {
    it('creates a scope with the provided scopeId', async () => {
      let capturedScopeId: string | null = null;

      await db.scope('my-request-123', async () => {
        capturedScopeId = db.getScopeId();
      });

      expect(capturedScopeId!).toBe('my-request-123');
    });

    it('returns the result of the callback function', async () => {
      const result = await db.scope('test-scope', async () => {
        return { success: true, data: [1, 2, 3] };
      });

      expect(result).toEqual({ success: true, data: [1, 2, 3] });
    });

    it('creates a scope with undefined scopeId', async () => {
      let capturedScopeId: string | null | undefined = 'unchanged';

      await db.scope(undefined, async () => {
        capturedScopeId = db.getScopeId();
      });

      expect(capturedScopeId).toBeNull();
    });

    it('reuses existing scope when nested', async () => {
      let outerScopeId: string | null = null;
      let innerScopeId: string | null = null;

      await db.scope('outer-scope', async () => {
        outerScopeId = db.getScopeId();

        await db.scope('inner-scope', async () => {
          innerScopeId = db.getScopeId();
        });
      });

      expect(outerScopeId!).toBe('outer-scope');
      expect(innerScopeId!).toBe('outer-scope');
    });

    it('isolates scopes between concurrent async operations', async () => {
      const scopeIds: (string | null)[] = [];

      await Promise.all([
        db.scope('scope-1', async () => {
          await new Promise((r) => setTimeout(r, 10));
          scopeIds.push(db.getScopeId());
        }),
        db.scope('scope-2', async () => {
          scopeIds.push(db.getScopeId());
        }),
      ]);

      expect(scopeIds).toContain('scope-1');
      expect(scopeIds).toContain('scope-2');
    });

    it('maintains scope through database operations', async () => {
      const capturedScopeIds: (string | null)[] = [];

      await db.scope('db-ops-scope', async () => {
        capturedScopeIds.push(db.getScopeId());

        await db.user.create({
          data: {
            email: `scope-test-${Date.now()}@example.com`,
            name: 'Scope Test',
          },
        });

        capturedScopeIds.push(db.getScopeId());
      });

      expect(capturedScopeIds).toEqual(['db-ops-scope', 'db-ops-scope']);
    });

    it('maintains scope through transactions', async () => {
      let scopeInTxn: string | null = null;

      await db.scope('txn-scope', async () => {
        await db.txn(async () => {
          scopeInTxn = db.getScopeId();
        });
      });

      expect(scopeInTxn!).toBe('txn-scope');
    });

    it('handles errors without losing scope state', async () => {
      let scopeBeforeError: string | null = null;

      try {
        await db.scope('error-scope', async () => {
          scopeBeforeError = db.getScopeId();
          throw new Error('Test error');
        });
      } catch {}

      expect(scopeBeforeError!).toBe('error-scope');
    });
  });

  describe('db.getScopeId', () => {
    it('returns null when not in a scope', () => {
      expect(db.getScopeId()).toBeNull();
    });

    it('returns the current scope ID when in a scope', async () => {
      await db.scope('active-scope', async () => {
        expect(db.getScopeId()!).toBe('active-scope');
      });
    });

    it('returns null after scope completes', async () => {
      await db.scope('completed-scope', async () => {});
      expect(db.getScopeId()).toBeNull();
    });

    it('returns null after scope fails', async () => {
      try {
        await db.scope('failed-scope', async () => {
          throw new Error('Test error');
        });
      } catch {}

      expect(db.getScopeId()).toBeNull();
    });

    it('returns scope ID from txn when started without explicit scope', async () => {
      let txnScopeId: string | null = null;

      await db.txn(async () => {
        txnScopeId = db.getScopeId();
      });

      expect(txnScopeId).not.toBeNull();
      expect(typeof txnScopeId).toBe('string');
    });
  });

  describe('scope and transaction interaction', () => {
    it('transaction inherits scope ID from parent scope', async () => {
      let scopeIdInScope: string | null = null;
      let scopeIdInTxn: string | null = null;

      await db.scope('parent-scope', async () => {
        scopeIdInScope = db.getScopeId();

        await db.txn(async () => {
          scopeIdInTxn = db.getScopeId();
        });
      });

      expect(scopeIdInScope!).toBe('parent-scope');
      expect(scopeIdInTxn!).toBe('parent-scope');
    });

    it('transaction creates its own scope ID when no parent scope', async () => {
      let scopeIdInTxn: string | null = null;

      await db.txn(async () => {
        scopeIdInTxn = db.getScopeId();
      });

      expect(scopeIdInTxn).not.toBeNull();
    });

    it('isInTxn works correctly within scope', async () => {
      let inTxnBeforeTxn = false;
      let inTxnDuringTxn = false;
      let inTxnAfterTxn = false;

      await db.scope('txn-test-scope', async () => {
        inTxnBeforeTxn = db.isInTxn();

        await db.txn(async () => {
          inTxnDuringTxn = db.isInTxn();
        });

        inTxnAfterTxn = db.isInTxn();
      });

      expect(inTxnBeforeTxn).toBe(false);
      expect(inTxnDuringTxn).toBe(true);
      expect(inTxnAfterTxn).toBe(false);
    });

    it('onCommit throws within scope without transaction', async () => {
      await db.scope('oncommit-scope', async () => {
        expect(() => db.onCommit(() => {})).toThrow('db.onCommit() requires db.txn()');
      });
    });

    it('afterCommit callbacks from multiple nested txn calls run once', async () => {
      const outerCallback = mock(() => {});
      const innerCallback = mock(() => {});

      await db.scope('nested-callbacks', async () => {
        await db.txn(async () => {
          db.onCommit(outerCallback);

          await db.txn(async () => {
            db.onCommit(innerCallback);
          });
        });
      });

      expect(outerCallback).toHaveBeenCalledTimes(1);
      expect(innerCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent scopes', () => {
    it('each concurrent scope has independent state', async () => {
      const results: { scopeId: string | null; isInTxn: boolean }[] = [];

      await Promise.all([
        db.scope('concurrent-1', async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push({
            scopeId: db.getScopeId(),
            isInTxn: db.isInTxn(),
          });
        }),
        db.scope('concurrent-2', async () => {
          await db.txn(async () => {
            results.push({
              scopeId: db.getScopeId(),
              isInTxn: db.isInTxn(),
            });
          });
        }),
      ]);

      const scope1Result = results.find((r) => r.scopeId === 'concurrent-1');
      const scope2Result = results.find((r) => r.scopeId === 'concurrent-2');

      expect(scope1Result?.isInTxn).toBe(false);
      expect(scope2Result?.isInTxn).toBe(true);
    });

    it('handles many concurrent scopes without interference', async () => {
      const numScopes = 10;
      const results: string[] = [];

      await Promise.all(
        Array.from({ length: numScopes }, (_, i) =>
          db.scope(`scope-${i}`, async () => {
            await new Promise((r) => setTimeout(r, Math.random() * 20));
            const scopeId = db.getScopeId();
            if (scopeId) results.push(scopeId);
          }),
        ),
      );

      expect(results.length).toBe(numScopes);
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(numScopes);
    });
  });
});
