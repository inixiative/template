# INFRA-048 — Lock sets from Zealot ZLT-5949

**Status:** ✅ Done — template main, 2026-11-05 · **Line:** INFRA · **Related:** INFRA-034, INFRA-035, Zealot ZLT-5949, ZLT-4600

## Problem

Upserting `findForUpdate` took one `createLock` lock per identifier, each with its own heartbeat
timer and its own release. In Zealot a 1000-contact bulk create held about 5000 of them in one
transaction: every 3s beat cost 5000 evals, and on a loaded CI runner the beats consumed the event
loop until the transaction expired. Separately, `verify()` kept a local loss latch, so a lock whose
key came back to its token after an observed loss still answered false.

## Design (ported from Zealot)

- `createLock({ service, identifiers: [...] })` is one lock over `lock:<service>:<identifier>` per
  identifier, deduplicated and sorted (`lockKeysOf`); an empty list is refused. One identifier is the
  plain single-key lock. Claims stay single-key.
- One token, one heartbeat, one release. Each step is one Lua call over the set: `fencedSetPrefix`
  per poll, `fencedRefreshAll` per beat, `fencedDeleteAll` to release.
- Acquisition progresses key by key in sorted order and keeps the keys it won, so it never needs
  every key free at once. A timeout or error gives back the keys won. A key lost while waiting
  restarts the acquire from the first key.
- A key lost while held is dropped from the heartbeat; the rest stay renewed, `onLockLost` fires
  once, and `release()` reports `notHeld`. The log label is the first key plus the count of the rest.
- `verify()` answers from Redis; only `release()` short-circuits it (Zealot ZLT-4600).
- `findForUpdate` takes one lock set over the identifiers the transaction does not hold yet
  (`holdLockSetUntilSettled`), joining the ones it already holds; `withLockUntilSettled` joins a key a
  set holds and the reverse.
- `FindForUpdateLockTimeoutError(model, identifier, waitMs)`, identifier `Model:hash (+N)`; the API
  answers it with a 409, *Another request is writing this record; please retry*.

Docs: `docs/claude/DATABASE.md#redis-locks-held-until-the-transaction-ends`,
`docs/claude/DATABASE.md#row-locks-and-create-if-missing`. Tests:
`packages/db/src/lock/createLock.test.ts`, `packages/db/src/test/findForUpdateUpserting.test.ts`,
`packages/db/src/test/withLockUntilSettled.test.ts`,
`apps/api/src/middleware/error/errorHandlerMiddleware.test.ts`.
