# INFRA-047 — An on-commit registry of outcomes: one action per key, run once after the hooks

**Status:** 💭 Deferred (needs design thought) · **Line:** INFRA · **Priority:** Low · **Related:** INFRA-046 (template #224), Zealot ZLT-6060 (#3059)

## Problem

A transaction that touches the same cache key more than once (read, write, read again) queues one
`db.onCommit` callback per touch. The batches run one after another in registration order, so:

- a write registered before a clear can publish a stale value for a moment before the clear removes it;
- if an earlier batch fails, the batches after it are skipped, so a stale write can be left cached for its
  whole TTL;
- a row written three times queues three clears (the cache invalidation hook already does this today).

Separately, `cache()` inside `db.txn()` should read the database directly and only reach Redis after
commit. Today that is the opt-in `shouldBypassInTxn`, which skips the cache entirely.

## Idea (Aron, 2026-10-27)

A registry beside `db.onCommit` for side effects that describe an outcome, not a list of callbacks:

- Keyed: the last registration for a key replaces the earlier ones, so each key gets one action that
  matches the transaction's final state. Step 1 read, step 2 write, step 3 read leaves one "write v2".
- Runs once per transaction, as its own wave: the first or the last wave of the commit hooks (open).
- Its entries may be a richer object than a callback: for the cache, an outcome such as clear, set, or
  trigger a rolling-cache refresh.

Cache use: `cache()` inside a transaction reads the database directly and registers "set" under its key;
the invalidation hook registers "clear" under the same key instead of calling `db.onCommit`. Both
cache writes and cache invalidations go through it.

## Constraints already known

- A commit-time set checks the generation captured before the read (a write committed by another
  transaction in between must win) and moves the generation when it writes (once the clear is replaced,
  nothing else cancels a `cache()` compute running outside the transaction on pre-commit data).
- Only outcome-shaped side effects belong here. Counters and event emits stay on `db.onCommit`, because
  last-wins would drop work.
- A rollback discards it, like every other commit hook.

## Open

- First wave or last wave, and why.
- The entry shape: a function, a value, or an outcome object per kind (cache: clear / set / refresh).
- Whether other side effects (WS refetch hints) join it.
- Name.
