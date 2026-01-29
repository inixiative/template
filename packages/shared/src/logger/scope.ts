import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<string[]>();

/**
 * Run code within a logging scope. Scopes stack automatically.
 *
 * @example
 * ```ts
 * await logScope(requestId, async () => {
 *   log.info('handling request'); // [api][req12345] handling request
 *
 *   await logScope(txnId, async () => {
 *     log.info('in transaction'); // [api][req12345][txn6789] in transaction
 *   });
 * });
 * ```
 */
export const logScope = <T>(id: string, fn: () => T): T => {
  const current = store.getStore() ?? [];
  return store.run([...current, id], fn);
};

/**
 * Get current scope IDs (for internal use by logger).
 */
export const getLogScopes = (): string[] => store.getStore() ?? [];
