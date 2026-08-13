# DB-001: Transaction identity in mutationLifeCycle — decide transaction-ness at the call boundary

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-08-13
**Updated**: 2026-08-13

> Zealot hit this as ZLT-4028 and ports the same fix. The invariant: nothing downstream of the
> caller's call boundary consults async-local storage.

---

## Problem

`db` is a Proxy that resolves `store.getStore()?.txn ?? db.raw` at property access, and
`mutationLifeCycle` opened every mutation interceptor with `if (!getDb().isInTxn()) return
reissueInTxn(model, operation, args)` — a second `isInTxn()` read, taken from inside the extension
callback. That callback runs on a Prisma-internal continuation, and the caller's ALS context is not
guaranteed to survive it: the caller frame sees `isInTxn() === true`, the extension sees `false`.
`reissueInTxn` then wraps the write in a **fresh** `db.txn` on the root client, which commits
immediately. A write issued inside `db.txn` outlives the outer rollback.

The template reproduces the same decision path without needing the ALS loss at all: a hooked
mutation on a `db.raw.$transaction` client has no ALS store registered, so the extension takes the
identical branch. On `main`, this test failed with the row surviving:

```ts
await db.raw.$transaction(async (transactionClient) => {
  await transactionClient.user.create({ data: { email, name: 'Should Roll Back' } });
  throw new Error('Intentional error');
});
expect(await db.user.findUnique({ where: { email } })).toBeNull(); // ← row survived
```

The same lost context also mis-routed hook-internal DB access (hooks resolved delegates off the
ambient proxy → `db.raw` → outside the transaction) and could fire `onCommit` against the wrong
state.

## Why the obvious fix does not exist

The executing client is not reachable from a query-extension interceptor in Prisma 7.8. Probed:
`this` is the interceptor's own arguments array (prototype chain `Array -> Object`),
`Prisma.getExtensionContext(this)` returns that same array, there is no `$parent`, the transaction
client exposes no `prisma.client.transaction.id` symbol and no `$extends`, and `args` is cloned
between the call site and the interceptor so it cannot carry a handle either.

What Prisma does expose is `params.__internalParams.transaction`: `undefined` outside a
transaction, `{ kind: 'itx', id }` inside an interactive one, `{ kind: 'batch', id, index }` for the
array form. It is decided by Prisma at request time and is unaffected by continuations.

## The fix

1. **Truthful predicate.** `readExecutingTransaction(params)` replaces all seven `isInTxn()` reads.
   No transaction → `reissueInTxn` as before (safe: there is no outer transaction to betray).
   Registered `itx` → run hooks against it. Unregistered `itx`, or `batch` → **throw**. A hooked
   mutation inside a transaction `db.txn()` did not open now fails loudly instead of committing
   independently of its caller.

2. **Registration handshake.** Prisma never tells the caller the id of the transaction it just
   opened, but every interceptor is told. `db.txn` opens a registration, issues one token-carrying
   `findFirst` on the transaction client, and the interceptor that sees the token binds
   `itx id → TransactionState` (`extensions/transactionRegistry.ts`). Cleared in `finally`, so
   timeouts and rollbacks release it. Costs one indexed primary-key miss per transaction.

3. **Explicit hook handle.** `HookOptions.db` is a `HookDb` — the executing transaction client plus
   an `onCommit` bound to that transaction's state. Hooks and pre-image fetches use it instead of
   the ambient client. `getDb()` survives only inside `reissueInTxn`, which legitimately starts a
   new managed transaction from a no-transaction context.

Caller-frame ALS is untouched: the `db` proxy, `isInTxn()`, `scope`, `parallel`, and `onCommit`'s
ambient path (still throws outside `db.txn`) all behave as before.

## Tasks

- [x] `readExecutingTransaction` + `resolveTransactionState` in `extensions/mutationLifeCycle.ts`
- [x] `extensions/transactionRegistry.ts` — registration handshake, `transactionStateFor`, `hookDbFor`
- [x] `db.txn` registers and deregisters; `TransactionState` moved to `clientTypes.ts`
- [x] `HookOptions.db` threaded through every hook and hook-private helper
- [x] `test/managedTransactions.test.ts` — unmanaged-transaction repro, reissue path, batch rollback
      atomicity, onCommit timing, and a pin test on `__internalParams.transaction`

## Definition of Done

- [x] The unmanaged-transaction repro fails on `main` and passes here
- [x] `bun run --cwd packages/db test` green
- [x] `bun run typecheck` green

## What this surfaced

`emailVersioning` was passing for the wrong reason. `saveEmailTemplate` wraps its component and
template writes in one `db.txn`; under the old code every one of those writes was reissued into its
own immediately-committing transaction, so the hook could read them back through any client. With
the writes correctly held inside the caller's transaction, `resolveComponentVersions` went blind —
its `lookupCascade` call resolved the ambient client, which is not the transaction. `lookupCascade`
now takes an optional client so hook callers pass their bound handle; every other caller runs on a
caller frame and keeps the ambient default.

## Related Tickets

- INFRA-022 (outbox drain isolation) — same `db.txn` / `onCommit` machinery
