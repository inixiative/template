/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses feature:auditLogs
 */

import { auditActorContextProvider } from '@template/db/lib/auditActorContext';

// Async-local storage does not survive into Prisma's query-extension continuations: a mutation
// issued inside db.txn() reaches the interceptor with store.getStore() === undefined even though
// __internalParams reports an active interactive transaction. Anything a hook needs from the
// caller's context therefore has to be carried across that gap explicitly.
//
// A provider is that carrier. capture() runs in the caller frame at db.txn() open, where storage is
// reliable; restore() is composed around hook invocation in the extension frame, so hooks keep
// reading their own ambient storage and never take a client parameter.
//
// Contract: capture happens at db.txn() open, so context entered after the transaction is already
// open is not visible to hooks on the lost-storage path. Set it at the request, job, or scope
// boundary. Restore is additive — a provider that captured nothing calls fn() rather than entering
// an empty context.

export type TransactionContextProvider<TSnapshot = unknown> = {
  name: string;
  capture: () => TSnapshot;
  restore: <TResult>(snapshot: TSnapshot, fn: () => TResult) => TResult;
};

export type TransactionContextSnapshot = {
  provider: TransactionContextProvider;
  snapshot: unknown;
};

const transactionContextProviders = new Map<string, TransactionContextProvider>();

export const registerTransactionContextProvider = <TSnapshot>(
  provider: TransactionContextProvider<TSnapshot>,
): void => {
  if (transactionContextProviders.has(provider.name)) {
    throw new Error(`Transaction context provider '${provider.name}' is already registered`);
  }
  transactionContextProviders.set(provider.name, provider as unknown as TransactionContextProvider);
};

export const captureTransactionContext = (): TransactionContextSnapshot[] =>
  [...transactionContextProviders.values()].map((provider) => ({ provider, snapshot: provider.capture() }));

// Nests each provider's restore around fn, first-registered outermost.
export const withTransactionContext = <TResult>(snapshots: TransactionContextSnapshot[], fn: () => TResult): TResult =>
  snapshots.reduceRight<() => TResult>(
    (next, { provider, snapshot }) =>
      () =>
        provider.restore(snapshot, next),
    fn,
  )();

// Seeded here rather than by a consumer: client.ts imports this module to capture, and db.txn is
// defined in client.ts, so reaching db.txn has necessarily loaded this line. There is no boot step
// to forget and no ordering to get wrong.
registerTransactionContextProvider(auditActorContextProvider);
