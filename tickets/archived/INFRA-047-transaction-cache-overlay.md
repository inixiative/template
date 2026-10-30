# INFRA-047 — cache() inside a transaction: a per-transaction overlay, published at commit

**Status:** ✅ Done — template #224, 2026-10-30 · **Line:** INFRA · **Related:** INFRA-046, Zealot ZLT-6069

## Problem

`cache()` inside `db.txn()` read and published as it does outside one. A miss computed on the
transaction's client and published the uncommitted row at once, and a rollback dropped the after-commit
clear that would have removed it: a `transactionAll` batch that promoted a viewer and then failed left
the viewer's token holding `own`. A hit ignored the transaction's own writes, so a member demoted in one
round of a `transactionAll` batch kept the role in the next.

## Design (Aron with Alexandre, 2026-10-27 to 2026-10-30)

- Each outermost transaction holds a cache overlay. Reads check the overlay, then the shared cache; a
  miss computes on the transaction's client and stays in the overlay. A rollback drops it.
- The clear-cache hook marks the keys a write invalidates; a marked key recomputes, so the transaction
  reads its own writes.
- A serialized queue per key orders a sibling's compute and store before a write's mark (batch
  sub-requests share one transaction).
- No single-flight lock inside a transaction.
- At commit, before the `db.onCommit` batches, each touched key runs one Lua call: a marked key is
  cleared, and a computed value is published only if the generation read before the compute is still
  current, so any other clear wins.
- Only the cache function sets a value; model writes only mark and clear.
- Long-lived values no write hook clears are read directly and refreshed asynchronously, never computed
  in a request's transaction.

Docs: `docs/claude/REDIS.md#cache-inside-a-transaction`. Tests: `apps/api/src/hooks/cache/hook.test.ts`,
`apps/api/src/modules/batch/tests/batchTransactionCache.test.ts`.
