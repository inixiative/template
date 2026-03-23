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
 * Get current scope IDs (for internal use by logger).
 */
export const getLogScopes = (): string[] => store.getStore() ?? [];

// --- Log broadcasting ---

export type LogBroadcastFn = (level: string, message: string) => void;

const broadcastStore = new AsyncLocalStorage<LogBroadcastFn[]>();

/**
 * Wrap execution in a log scope. All log calls within `fn` will include this scope.
 * Also initializes the broadcast store if not already active.
 */
export const logScope = <T>(id: string | LogScope, fn: () => T): T => {
  const current = store.getStore() ?? [];
  const broadcasts = broadcastStore.getStore();
  const run = () => store.run([...current, id], fn);
  return broadcasts ? run() : broadcastStore.run([], run);
};

/**
 * Register a broadcast target in the current scope.
 * All log calls in this async context will also be sent to the target.
 * Fire-and-forget — errors in targets never affect the log call.
 *
 * @example
 * await logScope(LogScope.worker, async () => {
 *   addLogBroadcast((_level, msg) => job.log(msg));
 *   log.info('this goes to stdout AND job.log()');
 * });
 */
export const addLogBroadcast = (target: LogBroadcastFn): void => {
  const broadcasts = broadcastStore.getStore();
  if (broadcasts) broadcasts.push(target);
};

/**
 * Get current broadcast targets (for internal use by logger).
 */
export const getLogBroadcasts = (): LogBroadcastFn[] => broadcastStore.getStore() ?? [];
