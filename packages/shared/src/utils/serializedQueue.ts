/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { LogScope, log } from '@template/shared/logger';

// Per-instance serialized queue. Each call to `run(fn)` waits for the previous
// to settle (success or failure) before invoking fn. Failures don't poison the
// chain — the next call still runs.
//
// Errors surface via the caller's returned promise OR Node's unhandledRejection
// (if the caller fire-and-forgets). We intentionally don't .catch() internally:
// that would tell Node "handled" when it isn't, hiding failures. `onError` is an
// observer, not a handler — it sees every failure (logging by default) and the
// rejection still propagates.
//
// In-process only. Cross-process safety needs a separate mechanism (e.g.
// `createLock` from @template/db for a Redis-backed lock).

export type SerializedQueue = {
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  size: () => number;
};

export type SerializedQueueOptions = {
  onError?: (err: unknown) => void;
};

const logError = (err: unknown): void => {
  log.error(`serialized queue task failed: ${err instanceof Error ? err.message : String(err)}`, LogScope.api);
};

export const createSerializedQueue = ({ onError = logError }: SerializedQueueOptions = {}): SerializedQueue => {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;

  return {
    run: <T>(fn: () => Promise<T>): Promise<T> => {
      pending++;
      const wrapped = async (): Promise<T> => {
        try {
          return await fn();
        } catch (err) {
          onError(err);
          throw err;
        } finally {
          pending--;
        }
      };
      const next = tail.then(wrapped, wrapped);
      tail = next;
      return next;
    },
    size: () => pending,
  };
};
