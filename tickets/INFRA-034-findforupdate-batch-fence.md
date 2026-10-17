# INFRA-034: `findForUpdate` upserting fence over a batch — one listed field, one lock per key

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-10-02
**Updated**: 2026-10-02

> Backport of Zealot ZLT-4988 (#2447). Zealot fenced every single-row FanUsers create on the row's
> unique keys, then found the bulk writers (a CSV import, a vendor sync) inserting the same rows with
> `createMany … skipDuplicates` and no fence at all, so a single-row writer racing a batch still lost
> on the unique index. A fence only works if every writer takes it, so the batch writers needed one
> too, without an N+1 of single-row fences.

---

## Problem

Upserting mode fenced exactly one row: a list or `{ in: [...] }` was refused, because the lock key
could only stand for one scalar-equality key. A batch writer had no way in short of calling
`findForUpdate` once per row.

## What landed

- **One field may list values.** `{ email: { in: [a, b] }, tenantId }` names the rows
  `(a, tenantId)` and `(b, tenantId)` (`findForUpdateLockIdentifiers`). Each value becomes the
  identifier a single-row fence on it computes, so a batch and a single-row writer contend on the
  same key. Any other field may be the listed one. Two or more listed fields are refused before any
  lock is taken. An empty list names no row and takes no lock, as non-upserting `{ in: [] }` already
  selects nothing.
- **A wrapper, not a second lock.** `acquireFindForUpdateLock` takes one ordinary `createLock` per key,
  the same lock a single-row fence takes, one at a time in sorted order, holding each while it waits
  on the next. Two batches that share keys meet on the lowest shared key first and the loser waits
  behind the winner, so overlapping batches finish in turn. (A first cut took the keys in parallel
  and released partial wins to retry; batches listing the same rows in opposite orders livelocked
  until both timed out — Zealot measured 1 in 8.) Keys this transaction already holds are skipped. A
  timeout or a Redis error releases every key already taken before it propagates. Every lock rides
  `finallyFns`, as before.

## Known costs

- **Heartbeats scale with the batch.** Each key keeps its own lease alive (3s heartbeat), so a
  1,000-row batch is ~333 refreshes/s while held. Fine for imports of hundreds; a large sync should
  fence in chunks.
- **A waiting batch holds what it has.** Keys sort below the one it waits on stay locked while it
  waits, so single-row writers on those rows wait too, for at most the batch's `waitMs`.
- **Order across calls is the caller's job.** The sort orders keys within one call; a transaction
  that fences several key shapes must fence them in the same order at every writer.
- **A fence is a lock on a key, not on a row.** A writer that inserts the same row without taking the
  same key shape is not fenced. Pick the shape from the row's unique keys and use it at every writer;
  where a row has two unique keys (Zealot FanUsers: the primary key and `(email, brandUuid)`), take
  both in one fixed order at every writer.

## Tests

`packages/db/src/test/findForUpdateUpserting.test.ts` — "fencing a batch with one listed field": each
value is its own Redis key; a batch waits on a single-row holder of any value; one that gives up
releases every key it had taken; overlapping batches in opposite orders both finish; contention is on the whole key; exactly one of three fields may list values, in any position;
two or three listed fields are refused with no lock taken; an empty list takes no lock; re-entry
acquires only the missing keys; a batch create races single-row creates into one row each. Every
test runs against the real database and Redis and asserts lock keys and rows; none spies on a client.

## Related

- Zealot ZLT-4988, PR #2447 (the port source; Zealot passes bare arrays, the template keeps its
  `{ in: [...] }` list syntax).
