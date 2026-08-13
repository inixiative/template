import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  clearHookRegistry,
  clearTransactionContextProviders,
  DbAction,
  db,
  HookTiming,
  registerDbHook,
  registerTransactionContextProvider,
} from '@template/db';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

const nextEmail = (label: string) => `${label}-${getNextSeq()}-${Date.now()}@test.com`;

const callerStore = new AsyncLocalStorage<string>();
const secondCallerStore = new AsyncLocalStorage<string>();

const callerStoreProvider = {
  name: 'testCallerStore',
  capture: () => callerStore.getStore() ?? null,
  restore: <TResult>(value: string | null, fn: () => TResult): TResult => (value ? callerStore.run(value, fn) : fn()),
};

const secondCallerStoreProvider = {
  name: 'testSecondCallerStore',
  capture: () => secondCallerStore.getStore() ?? null,
  restore: <TResult>(value: string | null, fn: () => TResult): TResult =>
    value ? secondCallerStore.run(value, fn) : fn(),
};

describe('transaction context providers', () => {
  beforeEach(() => {
    clearHookRegistry();
    clearTransactionContextProviders();
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
    clearTransactionContextProviders();
  });

  // Falsifiable without needing the async-local-storage loss to occur: the caller deliberately
  // exits its own context before issuing the write, so the only way the hook can see the value is
  // the capture-at-open / restore-at-hook bridge.
  it('delivers context captured at db.txn() open even when the caller has since exited it', async () => {
    registerTransactionContextProvider(callerStoreProvider);
    let observedInHook: string | null | undefined;

    registerDbHook('context-bridge-hook', 'User', HookTiming.after, [DbAction.create], async () => {
      observedInHook = callerStore.getStore() ?? null;
    });

    await callerStore.run('captured-at-open', async () => {
      await db.txn(async () => {
        await callerStore.exit(async () => {
          expect(callerStore.getStore()).toBeUndefined();
          await db.user.create({ data: { email: nextEmail('bridge'), name: 'Bridged' } });
        });
      });
    });

    expect(observedInHook).toBe('captured-at-open');
  });

  it('restores every registered provider around the same hook', async () => {
    registerTransactionContextProvider(callerStoreProvider);
    registerTransactionContextProvider(secondCallerStoreProvider);
    const observed: (string | null)[] = [];

    registerDbHook('context-bridge-multi', 'User', HookTiming.after, [DbAction.create], async () => {
      observed.push(callerStore.getStore() ?? null, secondCallerStore.getStore() ?? null);
    });

    await callerStore.run('first', () =>
      secondCallerStore.run('second', () =>
        db.txn(() =>
          callerStore.exit(() =>
            secondCallerStore.exit(() => db.user.create({ data: { email: nextEmail('multi'), name: 'Multi' } })),
          ),
        ),
      ),
    );

    expect(observed).toEqual(['first', 'second']);
  });

  it('runs hooks with the transaction intact when a provider captured nothing', async () => {
    registerTransactionContextProvider(callerStoreProvider);
    let hookRan = false;

    registerDbHook('context-bridge-empty', 'User', HookTiming.after, [DbAction.create], async () => {
      hookRan = true;
      // An empty capture must be inert: it neither throws nor costs the hook its transaction.
      expect(db.isInTxn()).toBe(true);
      await db.session.count();
    });

    await db.txn(() => db.user.create({ data: { email: nextEmail('empty'), name: 'Empty' } }));

    expect(hookRan).toBe(true);
  });

  it('runs hooks normally with no provider registered', async () => {
    let hookRan = false;

    registerDbHook('context-bridge-none', 'User', HookTiming.after, [DbAction.create], async () => {
      hookRan = true;
      expect(db.isInTxn()).toBe(true);
    });

    await db.txn(() => db.user.create({ data: { email: nextEmail('none'), name: 'None' } }));

    expect(hookRan).toBe(true);
  });

  it('rejects a different provider registered under a name already in use', () => {
    registerTransactionContextProvider(callerStoreProvider);

    expect(() =>
      registerTransactionContextProvider({
        name: callerStoreProvider.name,
        capture: () => null,
        restore: <TResult>(_snapshot: null, fn: () => TResult): TResult => fn(),
      }),
    ).toThrow("Transaction context provider 'testCallerStore' is already registered");
  });

  it('accepts the same provider registered twice, so every process boot path can register', () => {
    registerTransactionContextProvider(callerStoreProvider);
    expect(() => registerTransactionContextProvider(callerStoreProvider)).not.toThrow();
  });
});
