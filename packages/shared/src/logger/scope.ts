/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 */
import { AsyncLocalStorage } from 'node:async_hooks';

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

export const getLogScopes = (): string[] => store.getStore() ?? [];

// --- Log broadcasting ---

export type LogBroadcastFn = (level: string, message: string) => void;

const broadcastStore = new AsyncLocalStorage<LogBroadcastFn[]>();

export const logScope = <T>(id: string | LogScope, fn: () => T): T => {
  const current = store.getStore() ?? [];
  const broadcasts = broadcastStore.getStore();
  const run = () => store.run([...current, id], fn);
  return broadcasts ? run() : broadcastStore.run([], run);
};

export const addLogBroadcast = (target: LogBroadcastFn): void => {
  const broadcasts = broadcastStore.getStore();
  if (broadcasts) broadcasts.push(target);
};

export const getLogBroadcasts = (): LogBroadcastFn[] => broadcastStore.getStore() ?? [];
