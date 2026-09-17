import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { clearHookRegistry, DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { getNextSeq } from '@template/db/test/factory';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test/testTracker';

const nextEmail = (label: string) => `${label}-${getNextSeq()}-${Date.now()}@test.com`;

const callerStore = new AsyncLocalStorage<{ label: string }>();
const secondCallerStore = new AsyncLocalStorage<{ label: string }>();

describe('bridged hook context', () => {
  beforeEach(() => {
    clearHookRegistry();
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  // Falsifiable without needing the async-local-storage loss to occur: the caller exits its own
  // context before issuing the write, so the only way the hook can see the value is the bridge.
  it('delivers a declared store read at db.txn() open even when the caller has since exited it', async () => {
    let observedInHook: string | null | undefined;

    registerDbHook(
      'context-bridge-hook',
      'User',
      HookTiming.after,
      [DbAction.create],
      async () => {
        observedInHook = callerStore.getStore()?.label ?? null;
      },
      [callerStore],
    );

    await callerStore.run({ label: 'read-at-open' }, () =>
      db.txn(() => callerStore.exit(() => db.user.create({ data: { email: nextEmail('bridge'), name: 'Bridged' } }))),
    );

    expect(observedInHook).toBe('read-at-open');
  });

  it('carries the value by reference, so a hook mutating it mutates the caller object', async () => {
    const callerValue = { label: 'original' };

    registerDbHook(
      'context-bridge-identity',
      'User',
      HookTiming.after,
      [DbAction.create],
      async () => {
        const observed = callerStore.getStore();
        expect(observed).toBe(callerValue);
        if (observed) observed.label = 'mutated-in-hook';
      },
      [callerStore],
    );

    await callerStore.run(callerValue, () =>
      db.txn(() => db.user.create({ data: { email: nextEmail('identity'), name: 'Identity' } })),
    );

    expect(callerValue.label).toBe('mutated-in-hook');
  });

  it('enters the union of every declaring hook stores around each hook', async () => {
    const observed: (string | null)[] = [];

    registerDbHook(
      'context-bridge-first',
      'User',
      HookTiming.after,
      [DbAction.create],
      async () => {
        observed.push(callerStore.getStore()?.label ?? null, secondCallerStore.getStore()?.label ?? null);
      },
      [callerStore],
    );

    registerDbHook('context-bridge-second', 'User', HookTiming.after, [DbAction.create], async () => {}, [
      secondCallerStore,
    ]);

    await callerStore.run({ label: 'first' }, () =>
      secondCallerStore.run({ label: 'second' }, () =>
        db.txn(() =>
          callerStore.exit(() =>
            secondCallerStore.exit(() => db.user.create({ data: { email: nextEmail('multi'), name: 'Multi' } })),
          ),
        ),
      ),
    );

    expect(observed).toEqual(['first', 'second']);
  });

  it('leaves a declared store the caller never entered unentered in the hook', async () => {
    let observedInHook: { label: string } | undefined | null = null;

    registerDbHook(
      'context-bridge-unset',
      'User',
      HookTiming.after,
      [DbAction.create],
      async () => {
        observedInHook = callerStore.getStore();
        expect(db.isInTxn()).toBe(true);
      },
      [callerStore],
    );

    await db.txn(() => db.user.create({ data: { email: nextEmail('unset'), name: 'Unset' } }));

    expect(observedInHook).toBeUndefined();
  });

  // Whether an undeclared store still happens to be visible is a property of the frame and not
  // something to rely on in either direction; what is guaranteed is that capturing nothing is inert.
  it('runs hooks with the transaction intact when no hook declares a store', async () => {
    let hookRan = false;

    registerDbHook('context-bridge-none', 'User', HookTiming.after, [DbAction.create], async () => {
      hookRan = true;
      expect(db.isInTxn()).toBe(true);
      await db.session.count();
    });

    await db.txn(() => db.user.create({ data: { email: nextEmail('none'), name: 'None' } }));

    expect(hookRan).toBe(true);
  });
});
