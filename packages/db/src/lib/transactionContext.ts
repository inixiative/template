/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// Async-local storage does not survive into Prisma's query-extension continuations: a mutation
// issued inside db.txn() reaches the interceptor with store.getStore() === undefined even though
// __internalParams reports an active interactive transaction. Anything a hook needs from the
// caller's context therefore has to be carried across that gap explicitly.
//
// A transaction context provider is that carrier. `capture()` runs in the caller frame at db.txn()
// open, where storage is reliable, and returns a snapshot. `restore(snapshot, fn)` is composed
// around hook invocation in the extension frame, re-entering the context for the whole hook
// subtree — so hooks keep reading their own ambient storage and never take a client parameter.
//
// Contract: capture happens at db.txn() open. Context set after the transaction is already open is
// not visible to hooks on the lost-storage path. Set context at the request, job, or scope boundary
// — which is where every provider in this repo sets it — and it is always captured in time.
//
// Restoring is additive, never destructive: a provider that captured nothing should call fn()
// rather than entering an empty context, so a hook frame that did keep its storage keeps its value.
// Which of those two happens is a property of the frame, not something to depend on in either
// direction — capture at the boundary is the guarantee.

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

// Registering the same name twice is a boot-order bug, not a merge of two contexts — the second
// provider would silently shadow the first for every transaction in the process.
export const registerTransactionContextProvider = <TSnapshot>(
  provider: TransactionContextProvider<TSnapshot>,
): void => {
  const existing = transactionContextProviders.get(provider.name);
  if (existing && existing !== (provider as unknown as TransactionContextProvider)) {
    throw new Error(`Transaction context provider '${provider.name}' is already registered`);
  }
  transactionContextProviders.set(provider.name, provider as unknown as TransactionContextProvider);
};

export const clearTransactionContextProviders = (): void => {
  transactionContextProviders.clear();
};

export const captureTransactionContext = (): TransactionContextSnapshot[] =>
  [...transactionContextProviders.values()].map((provider) => ({ provider, snapshot: provider.capture() }));

// Nests each provider's restore around fn, outermost first, so a provider registered earlier wraps
// one registered later. Providers are independent, so the order only matters if one reads another.
export const withTransactionContext = <TResult>(
  snapshots: TransactionContextSnapshot[],
  fn: () => TResult,
): TResult =>
  snapshots.reduceRight<() => TResult>(
    (next, { provider, snapshot }) =>
      () =>
        provider.restore(snapshot, next),
    fn,
  )();
