# DB-001: Transaction identity in mutationLifeCycle — decide transaction-ness at the call boundary

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-08-13
**Updated**: 2026-08-13

> Zealot hit this as ZLT-4028 and ports the same fix. The invariant: nothing downstream of the
> caller's call boundary *decides* anything from async-local storage. What it needs from the caller
> is carried across the boundary explicitly, once, by the db package — not threaded through callers.

---

## Problem

`db` is a Proxy that resolves `store.getStore()?.txn ?? db.raw` at property access, and
`mutationLifeCycle` opened every mutation interceptor with `if (!getDb().isInTxn()) return
reissueInTxn(model, operation, args)` — a second `isInTxn()` read, taken from inside the extension
callback. That callback runs on a Prisma-internal continuation, and the caller's ALS context does
not survive it. `reissueInTxn` then wrapped the write in a **fresh** `db.txn` on the root client,
which commits immediately. A write issued inside `db.txn` outlives the outer rollback.

This is not theoretical and not Zealot-only. Instrumenting the interceptor on this repo:

```
TXN-ENTER  storeSet=true sameState=true
INTERCEPT  EmailComponent.create alsIsInTxn=false alsScopeId=null
           exec={"kind":"itx","id":"a664607e-96c5-4a7a-bae6-87def192a6b2"}
```

The store is present when `db.txn` enters its callback and gone by the interceptor, same module
instance, while Prisma correctly reports an active interactive transaction. Deterministic on the
`saveEmailTemplate` path (`packages/email/src/render/save.ts`), 6/6 runs. It is path-dependent, not
shape-dependent: prior awaited Prisma reads (0–12), plain awaits (0–50), `Promise.all` over Prisma
thenables, `.then`-chained Prisma, `$queryRaw`, and awaited raw custom thenables all preserve the
context in isolation. There is no rule to apply by hand; the fix has to be structural.

The template also reaches the same decision path with no ALS loss at all: a hooked mutation on a
`db.raw.$transaction` client has no ALS store registered, so the extension takes the identical
branch. On `main`:

```ts
await db.raw.$transaction(async (transactionClient) => {
  await transactionClient.user.create({ data: { email, name: 'Should Roll Back' } });
  throw new Error('Intentional error');
});
expect(await db.user.findUnique({ where: { email } })).toBeNull(); // ← row survived
```

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

3. **A context bridge at the hook boundary.** `runInTransactionContext(transactionState, fn)`
   re-enters the caller's context from inside the continuation: `store.run` for the transaction
   state itself — so the ambient `db` proxy resolves to the executing transaction for the whole
   hook subtree — then each registered provider's captured context nested inside it. The mutation
   extension composes it around every `executeHooks` call. Hooks are unchanged from `main`: no
   client parameter, no signature churn, and the repair covers everything a hook transitively
   calls rather than only what someone remembered to thread.

   `lib/transactionContext.ts` owns the provider interface and stays downstream-agnostic:

   ```ts
   type TransactionContextProvider<TSnapshot> = {
     name: string;
     capture: () => TSnapshot;                                        // caller frame, at db.txn() open
     restore: <TResult>(snapshot: TSnapshot, fn: () => TResult) => TResult;  // extension frame, around hooks
   };
   ```

   Contract: capture happens at `db.txn()` open, so context entered after the transaction is
   already open is not visible to hooks on the lost-storage path. Restoring is additive — a provider
   that captured nothing calls `fn()` rather than entering an empty context. Set context at the
   request, job, or scope boundary, which is where every provider here already sets it.

   The one provider that exists is seeded in `transactionContext.ts` itself. `client.ts` imports
   that module to capture, and `db.txn` is defined in `client.ts`, so reaching `db.txn` has
   necessarily executed the registration — there is no boot step to wire and no ordering to get
   wrong. `registerTransactionContextProvider` stays exported for a future app-owned context.

Caller-frame ALS is untouched: the `db` proxy, `isInTxn()`, `scope`, `parallel`, and `onCommit`'s
ambient path (still throws outside `db.txn`) all behave as before. Pre-image reads
(`fetchExistingRecord`/`fetchExistingRecords`) run in the extension frame, which holds the
transaction client directly, so they need no bridge.

## What the bridge fixed that threading could not

`auditActorContext` is a second `AsyncLocalStorage`, read from hook frames in three places
(`auditLog/hook.ts`, `emailVersioning/snapshot.ts`, `webhooks/hook.ts`). On the `saveEmailTemplate`
path it was lost with everything else, so every audit row that path wrote was attributed to nobody:

```
ACTOR at caller frame: transactionContextProbe
ACTOR on audit rows:   componentRows=1 [null]  templateRows=1 [null]
```

Silently, with the suite green — on `main` and equally under a client-threading fix, which cannot
reach an ambient context it does not carry. `auditActorContextProvider` now rides the bridge, and
`hooks/auditLog/transactionContext.test.ts` pins it on that exact path. That test fails when the
registration line is removed and passes with it, verified both ways.

The webhook origin/echo-suppression read rides the same provider. Its existing coverage exercises a
path where storage survives, so it is not an independent pin; the actor test covers the mechanism.

## Tasks

- [x] `readExecutingTransaction` + `resolveTransactionState` in `extensions/mutationLifeCycle.ts`
- [x] `extensions/transactionRegistry.ts` — registration handshake, `transactionStateFor`
- [x] `db.txn` registers and deregisters; `TransactionState` moved to `clientTypes.ts`
- [x] `lib/transactionContext.ts` — provider interface, capture/restore, registration
- [x] `runInTransactionContext` on the client; composed around every `executeHooks` call
- [x] `auditActorContextProvider` seeded by the registry, guaranteed by the import graph
- [x] `test/managedTransactions.test.ts` — unmanaged-transaction repro, reissue path, batch rollback
      atomicity, onCommit timing, and a pin test on `__internalParams.transaction`
- [x] `test/transactionContext.test.ts` — bridge delivery, multi-provider, empty capture, duplicate
      registration
- [x] `hooks/auditLog/transactionContext.test.ts` — actor survives the lost-storage path

## Definition of Done

- [x] The unmanaged-transaction repro fails on `main` and passes here
- [x] The audit-actor pin fails without the provider and passes with it
- [x] `packages/db` 266 pass, `packages/email` 89 pass, `packages/permissions` 81 pass
- [x] `apps/api` 920 pass / 3 fail — the 3 are `s3 storage adapter`, identical on `main`
- [x] `typecheck` green for `db`, `email`, `permissions`, `api`

## Why not thread an explicit client through the hooks

That was the first shape of this fix and it was reverted. It changed 18 hook files, `orderedList.ts`
and `lookupCascade`'s signature, and left `lookupCascade(slugs, ctx, client = db)` — an optional
parameter whose default is wrong in exactly the case that motivated adding it. It could not reach
`auditActorContext` at all. Measured against the bridge on the same suites, the two are
behaviourally identical (`918 pass / 3 fail` either way at the time of comparison) while threading
costs 29 changed files against 9, and only repairs what was threaded by hand.

Evidence that re-entering storage inside the continuation is safe: a fresh `store.run` established
in a hook frame with no ambient value held across 480 checkpoints (microtask, `queueMicrotask`,
`setTimeout`, `setImmediate`, Prisma `findMany`/`findUnique`, a raw custom thenable, both
`Promise.all` branches) with zero drift; 180 hook runs across 30 concurrent transactions × 6 rounds
with zero lost or cross-wired contexts; 195 checks down a 12-deep recursion interleaved with Prisma
awaits, zero failures. The known bun failure mode loses a frame *captured before* a thenable;
`run()` installs its frame synchronously at call time, so it is not exposed to it — and `db.txn`
itself is already a `store.run` in whatever frame called it.

## Related Tickets

- INFRA-022 (outbox drain isolation) — same `db.txn` / `onCommit` machinery
