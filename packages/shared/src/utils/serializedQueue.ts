/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 */
// Per-instance serialized queue. Each call to `run(fn)` waits for the previous
// to settle (success or failure) before invoking fn. Failures don't poison the
// chain — the next call still runs.
//
// Errors surface via the caller's returned promise OR Node's unhandledRejection
// (if the caller fire-and-forgets). We intentionally don't .catch() internally:
// that would tell Node "handled" when it isn't, hiding failures. Matches the
// p-queue / async-mutex convention.
//
// In-process only. Cross-process safety needs a separate mechanism (e.g.
// `createLock` from @template/db for a Redis-backed lock).

export type SerializedQueue = {
  run: <T>(fn: () => Promise<T>) => Promise<T>;
};

export const createSerializedQueue = (): SerializedQueue => {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run: <T>(fn: () => Promise<T>): Promise<T> => {
      // Run fn whether tail succeeded or failed — the chain doesn't poison.
      // tail keeps the rejection state; the next call's onReject branch
      // consumes it, or Node's unhandledRejection surfaces if no one handles.
      const next = tail.then(
        () => fn(),
        () => fn(),
      );
      tail = next;
      return next;
    },
  };
};
