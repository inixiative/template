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
  email = 'email',
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

// --- Log broadcasting ---

export type LogBroadcastFn = (level: string, message: string) => void;

const broadcastStore = new AsyncLocalStorage<LogBroadcastFn[]>();

/**
 * Register a broadcast target for all log calls within `fn`.
 * Broadcasts are fire-and-forget — errors in targets never affect the log call.
 *
 * @example
 * logBroadcast((level, msg) => job.log(msg), async () => {
 *   log.info('this goes to stdout AND job.log()');
 * });
 */
export const logBroadcast = <T>(target: LogBroadcastFn, fn: () => T): T => {
  const current = broadcastStore.getStore() ?? [];
  return broadcastStore.run([...current, target], fn);
};

/**
 * Get current broadcast targets (for internal use by logger).
 */
export const getLogBroadcasts = (): LogBroadcastFn[] => broadcastStore.getStore() ?? [];
