/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { AfterCommitFn, HookDb, TransactionState } from '@template/db/clientTypes';
import { type ConcurrencyType, getConcurrency } from '@template/shared/utils';
import { castArray } from 'lodash-es';

// Prisma never hands the caller the id of the interactive transaction it just opened, but every
// query interceptor is told which transaction its op is executing on. db.txn() therefore opens a
// registration, issues one token-carrying read, and the interceptor that sees the token binds the
// two together — the only link between the caller frame and the extension that does not depend on
// async-local storage surviving a Prisma-internal continuation.
const pendingRegistrations = new Map<string, TransactionState>();
const transactionStates = new Map<string, TransactionState>();
const hookDbHandles = new WeakMap<TransactionState, HookDb>();

export const openTransactionRegistration = (transactionState: TransactionState): string => {
  const registrationToken = crypto.randomUUID();
  pendingRegistrations.set(registrationToken, transactionState);
  return registrationToken;
};

export const pendingRegistrationToken = (args: unknown): string | undefined => {
  const identifier = (args as { where?: { id?: unknown } } | undefined)?.where?.id;
  return typeof identifier === 'string' && pendingRegistrations.has(identifier) ? identifier : undefined;
};

export const claimTransactionRegistration = (registrationToken: string, transactionId: string): void => {
  const transactionState = pendingRegistrations.get(registrationToken);
  if (!transactionState) return;
  pendingRegistrations.delete(registrationToken);
  transactionState.transactionId = transactionId;
  transactionStates.set(transactionId, transactionState);
};

export const closeTransactionRegistration = (registrationToken: string, transactionState: TransactionState): void => {
  pendingRegistrations.delete(registrationToken);
  if (transactionState.transactionId) transactionStates.delete(transactionState.transactionId);
  transactionState.transactionId = null;
};

export const transactionStateFor = (transactionId: string): TransactionState | undefined =>
  transactionStates.get(transactionId);

export const pushAfterCommit = (
  transactionState: TransactionState,
  callbacks: AfterCommitFn | AfterCommitFn[],
  types?: ConcurrencyType | ConcurrencyType[],
): void => {
  const callbackList = castArray(callbacks);
  const typeList = types ? castArray(types) : undefined;
  transactionState.afterCommitBatches.push({
    fns: callbackList,
    concurrency: getConcurrency(typeList),
    types: typeList,
  });
};

// Resolves the transaction client per property access rather than capturing it: a scope reuses one
// TransactionState across sequential db.txn() calls, so a captured client goes stale on the second.
export const hookDbFor = (transactionState: TransactionState): HookDb => {
  const existing = hookDbHandles.get(transactionState);
  if (existing) return existing;

  const handle = new Proxy({} as object, {
    get(_, property) {
      if (property === 'onCommit') {
        return (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]) =>
          pushAfterCommit(transactionState, callbacks, types);
      }
      const transactionClient = transactionState.txn;
      if (!transactionClient) throw new Error('Hook db handle used after its transaction ended');
      const value = Reflect.get(transactionClient as object, property);
      return typeof value === 'function' ? value.bind(transactionClient) : value;
    },
  }) as HookDb;

  hookDbHandles.set(transactionState, handle);
  return handle;
};
