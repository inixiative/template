# INFRA-035 — `createLock.acquire` waits

**Status:** done · **Line:** INFRA · **Related:** INFRA-031, INFRA-034, Zealot ZLT-5169 (#2531)

## Problem

Every caller that queues behind a lock holder re-implemented the same loop: `while (!(await
lock.acquire()))` with a deadline, a sleep, and its own timeout error. `acquireFindForUpdateLock`
carried one; Zealot's per-brand rule-save lock grew a second; the cache single-flight has a cousin.
The queue-behind-the-holder shape is part of what a lock is.

## Change

```ts
acquire(options?: { waitMs?: number; pollMs?: number; onTimeout?: () => Error }): Promise<boolean>
```

- No options: one SET NX, true or false at once, as before.
- `waitMs`: keep trying every `pollMs` (default 50) until it wins or the wait runs out.
- `onTimeout`: the error a timed-out wait throws, so a caller that must fail loudly (a named lock
  error, a 409) does not wrap a boolean in its own if/throw. Without it a timed-out wait returns
  false like a plain contended acquire.

`acquireFindForUpdateLock` is one call now. The cache single-flight wait is left alone: it polls
the cache between acquires, which is a different loop.

A waiter polling inside an interactive transaction must keep `waitMs` under the transaction's own
timeout, or it expires while still waiting — unchanged, and still the caller's to size.
