import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Common log scopes used across the codebase.
 * Use these for consistency, or pass custom strings for one-off scopes.
 */
export enum LogScope {
  api = 'api',
  db = 'db',
  worker = 'worker',
  seed = 'seed',
  ws = 'ws',
  test = 'test',
  auth = 'auth',
  cache = 'cache',
  hook = 'hook',
  job = 'job',
}

const store = new AsyncLocalStorage<string[]>();

/**
 * Wrap execution in a log scope. All log calls within `fn` will include this scope.
 */
export const logScope = <T>(id: string | LogScope, fn: () => T): T => {
  const current = store.getStore() ?? [];
  return store.run([...current, id], fn);
};

/**
 * Get current scope IDs (for internal use by logger).
 */
export const getLogScopes = (): string[] => store.getStore() ?? [];
