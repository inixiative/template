# DB-002: findForUpdate upserting mode — fence the key, not the row

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-09-24
**Updated**: 2026-09-24

> Zealot ports the same design as ZLT-5042. Naming is shared across both repos.

---

## Problem

`db.findForUpdate(model, where)` runs `SELECT * ... FOR UPDATE`. On a row that exists, that
serializes writers. On a row that does not exist yet it locks nothing — Postgres has no gap locks,
and READ COMMITTED would not take them anyway — so find-then-create inside `db.txn` races: two
callers both read nothing and both insert. Call sites patch that locally with a bare `.upsert(` or
by catching the unique violation (`isUniqueConstraintError` / `P2002`), re-reading and retrying.
Each patch is a per-call-site answer to a primitive's gap.

## The rule

1. **Lock, then fence.** Take a Redis lock on the where-key first, then run the `SELECT ... FOR
   UPDATE`. Querying first lets both callers see nothing before either locks.
2. **Release on `onFinally`.** The lock drops when the transaction ends, commit or rollback —
   after the database transaction has settled (a release before commit lets a waiter read
   pre-commit state) and before the on-commit callbacks (a release behind slow side effects stalls
   every waiter).
3. **Waiter timeout < transaction timeout.** A waiter holds an open transaction. It waits
   `waitMs` (default 3000ms, under Prisma's 5000ms interactive default) and then throws
   `FindForUpdateLockTimeoutError`, rolling back rather than letting the transaction timeout fire.

## What changed

- `db.onFinally(fns)` — `packages/db/src/client.ts`. A queue on the open transaction
  (`OpenTransaction.finallyFns`), drained in a `finally` around `db.raw.$transaction(...)` — i.e.
  after it resolves or rejects — and before the on-commit batches. All callbacks run; failures are
  logged, never thrown. Throws outside `db.txn()`, like `onCommit`.
- `db.findForUpdate(model, where, { upserting: true, waitMs? })` — same return type (0 or 1 rows).
  Validation, key and wait live in `packages/db/src/lock/`:
  - `findForUpdateLockIdentifier.ts` — rejects an empty where and any value that is not a scalar
    equality (arrays, `{ in }`, operator objects, `null`, `undefined`); identifier is
    `<Model>:<sha256 of the key-sorted entries>`.
  - `acquireFindForUpdateLock.ts` — `createLock({ service: 'find-for-update', ttlMs: 10_000,
    heartbeatMs: 3_000, maxMissed: 1 })`, polls every 25ms until `waitMs`, registers the release
    with the transaction's finally queue, and skips re-acquiring a key the same transaction holds
    (`OpenTransaction.heldLockKeys`).
  - `findForUpdateLockTimeoutError.ts` — exported from `@template/db`.
- `makeSingletonJob` already runs on `createLock` (owner-checked refresh, fenced release) — no
  change. `makeSupersedingJob` / lanes keep latest-wins semantics.
- CI: `scripts/ci/rules/no-create-race-machinery.sh` — per-file ratchet vs the merge base on
  `.upsert(`, `P2002` and `isUniqueConstraintError(` (tests, factories, seeds, generated code and
  the helper's definition exempt; comment lines not counted).
- Docs: `docs/claude/DATABASE.md` — finally callbacks, create-if-missing.

## Tests

- `packages/db/src/test/onFinally.test.ts` — runs after commit (sees the committed row), runs on
  rollback with the error propagating, one throwing callback does not stop the rest, runs before
  on-commit callbacks, nested `db.txn` registers on the outer.
- `packages/db/src/test/findForUpdateUpserting.test.ts` — 5 concurrent create-if-missing on one
  email produce one row and no P2002 (fails with P2002 when the acquire is removed); released after
  commit and after rollback; waiter timeout throws `FindForUpdateLockTimeoutError`; re-entrant
  fence does not deadlock; key is order-independent; validation rejects arrays/`in`/operators/
  null/undefined/empty.

## Follow-ups

- Migrate the existing ratcheted call sites (`hooks/userEmailContact/hook.ts`, `lib/observe.ts`,
  `jobs/outbox/accumulator.ts`) where the upsert is covering a create race rather than expressing
  an idempotent write.

## Related

- Zealot ZLT-5042
- DB-001 (transaction identity in mutationLifeCycle)
