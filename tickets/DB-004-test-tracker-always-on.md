# DB-004: The test tracker is always on, and tests never clean up by hand

**Status**: ✅ Done
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-10-13
**Updated**: 2026-10-13
**Related**: ZLT-5618 (Zealot mirror)

---

## Ruling (Aron, 2026-10-13)

The test tracker is always registered, and a test never deletes rows by hand in an after hook. Cleanup
stays per file (`cleanupTouchedTables`); there's no global cleanup, because most files here seed in
`beforeAll` and clean in `afterAll`.

## Today

- Nothing registers the tracker globally. 29 test files opt in with `registerTestTracker()`; a file
  that forgets cleans nothing. The `userEmail` hook test leaked its users until `e081f36b`.
- 9 test files `delete`/`deleteMany`/`TRUNCATE` in `afterEach`/`afterAll`: rows the tracker didn't
  see, or deletes that duplicate `cleanupTouchedTables`.

## Change

1. Each test package's preload (`apps/api`, `packages/db`, `packages/email`) registers the tracker;
   the per-file calls go.
2. Each hand-delete is either a tracker blind spot, fixed so the tracker sees the write, or redundant
   and removed.
3. CI rules: no `delete`/`deleteMany`/`TRUNCATE` inside an after hook in a test file, and no in-file
   `registerTestTracker`. Exceptions need a stated reason.

## Done (2026-10-13)

- `packages/db/src/client.ts` registers the tracker (no-op outside test). `clearHookRegistry()` keeps
  it: it belongs to the test process, so a file clearing its own hooks no longer turns tracking off
  for every file after it. That's the case the 31 per-file calls were quietly papering over.
- The 31 per-file `registerTestTracker()` calls are gone.
- The 9 hand-cleanup files now call `cleanupTouchedTables(db)`. The two rule-reference suites seed
  their org and space per test, since a per-test cleanup would delete a `beforeAll` seed. Each file was
  run with rows counted before and after: zero left. After the full API suite, every table is empty.
- `scripts/lint/check-test-hand-cleanup.sh` and `check-test-tracker-registration.sh` run in
  `lint:postBiome`.
