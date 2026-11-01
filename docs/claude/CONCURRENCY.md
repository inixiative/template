# Concurrency

<!-- toc:start -->

## Contents

- [Serialized Queue (`createSerializedQueue`)](#serialized-queue-createserializedqueue)
  - [When to use](#when-to-use)
  - [When NOT to use](#when-not-to-use)
  - [Error model](#error-model)
  - [Implementation](#implementation)
- [Concurrency Limits (`getConcurrency`)](#concurrency-limits-getconcurrency)
- [Bounded Batch (`resolveAll`)](#bounded-batch-resolveall)
- [Distributed Lock (`createLock`)](#distributed-lock-createlock)
- [Supersede Lanes (`claimLane` / `watchLane`)](#supersede-lanes-claimlane--watchlane)
- [Job Lanes (`withLanePriority`)](#job-lanes-withlanepriority)
- [Recurring Beat (`heartbeat`)](#recurring-beat-heartbeat)
- [Row Locks (`db.findForUpdate`)](#row-locks-dbfindforupdate)
- [Cross-references](#cross-references)

<!-- toc:end -->

Mechanisms for coordinating async operations. Different concerns, different tools.

| Concern | Tool | Scope |
|---|---|---|
| Cap parallelism (don't open 1000 DB connections at once) | `getConcurrency` + `ConcurrencyType` | in-process |
| Run a batch with a concurrency cap, get ordered results | `resolveAll` | in-process |
| Serialize writes to one resource (no interleaving) | `createSerializedQueue` | in-process |
| Lock rows you read and then write inside a transaction | `db.findForUpdate` | in-transaction (Postgres row lock) |
| Only one process owns this resource | `createLock` | cross-process (Redis) |
| Newest job for a key wins; older ones bow out | `claimLane` / `watchLane` | cross-process (Redis) |
| Background work yields to foreground work in one shared queue | job lanes (`withLanePriority`) | cross-process (BullMQ priority) |
| Run a recurring beat without overlapping itself | `heartbeat` | in-process timer |

The ordering and mutual-exclusion primitives — `createSerializedQueue`, `createLock` and `claimLane` / `watchLane` — carry the atlas tag `mutex`: `bunx atlas query --partOf mutex` lists them.

Combine when needed: a per-resource Redis lock + a per-resource serialized queue is the canonical pair for "one instance owns this AND that instance serializes its own writes" — `createLock` to claim ownership, `createSerializedQueue` to order that owner's writes.

---

## Serialized Queue (`createSerializedQueue`)

`@template/shared/utils/serializedQueue`. Per-instance promise chain — each `run(fn)` waits for the previous to settle before invoking. In-process only.

```ts
import { createSerializedQueue } from '@template/shared/utils';

const queue = createSerializedQueue();

await queue.run(async () => updateA());
await queue.run(async () => updateB());  // doesn't start until updateA settles
```

### When to use

You have multiple async callsites that all mutate the same shared resource (in-memory map, encrypted DB blob, log file, etc.) and they fire concurrently. Without serialization, two read-modify-write cycles interleave and one clobbers the other.

Illustrative example — an encrypted-blob auth adapter where two writers share one record:
- `keys.set` and `creds.update` both rewrite the entire encrypted blob
- Both fire during normal operation (key rotation, session updates)
- Without the queue, an in-memory `stored` value would be read+modified by overlapping writes and silently lose data on persist

WebSocket data streams use one queue per stream key (`apps/api/src/ws/streamPublishOrder.ts`) so an instance publishes a stream's appends in the order they were emitted, including when a publish falls back to local delivery. See [WEBSOCKETS.md](./WEBSOCKETS.md#ordering).

### When NOT to use

- Need to cap parallelism but allow N in flight → `getConcurrency`
- Multiple processes can race for the resource → `createLock` (or both)
- The operations are independent → just run them, no serialization needed

### Error model

Errors propagate via the caller's returned promise OR Node's `unhandledRejection` if the caller fire-and-forgets. The queue does **not** add an internal catch — that would tell Node "handled" when it isn't, silently losing failures. Matches the [p-queue](https://github.com/sindresorhus/p-queue) / [async-mutex](https://github.com/DirtyHairy/async-mutex) convention.

```ts
// Awaited — caller handles
try {
  await queue.run(async () => mightFail());
} catch (err) { /* handle */ }

// Fire-and-forget — Node's unhandledRejection surfaces if no one catches.
// Don't fire-and-forget unless that visibility is what you want.
queue.run(async () => mightFail());
```

The chain doesn't poison: if one op rejects, the next still runs.

### Implementation

```ts
let tail: Promise<unknown> = Promise.resolve();
run = (fn) => {
  const next = tail.then(() => fn(), () => fn());
  tail = next;
  return next;
};
```

Six lines. The `.then(onSuccess, onReject)` form ensures fn runs whether the previous op resolved or rejected. `tail` carries any rejection forward; the next call's onReject branch consumes it (or Node surfaces it if no next call).

---

## Concurrency Limits (`getConcurrency`)

`@template/shared/utils/concurrency`. Pre-defined caps for different resource classes (db, redis, queue, socket, etc.). Pass to `Promise.all`-style batches or BullMQ workers.

```ts
import { getConcurrency, ConcurrencyType } from '@template/shared/utils';

const limit = getConcurrency([ConcurrencyType.db, ConcurrencyType.integration]);
// limit = min(10, 5) = 5
```

Use when you'd otherwise blow through a connection pool or rate limit.

---

## Bounded Batch (`resolveAll`)

`@template/shared/utils/resolveAll`. `Promise.all` with an optional concurrency cap. Takes an array of thunks (`() => Promise<T>`) rather than promises, so it controls *when* each starts. Results come back in input order regardless of completion order.

```ts
import { resolveAll, getConcurrency, ConcurrencyType } from '@template/shared/utils';

const results = await resolveAll(
  ids.map((id) => () => fetchRecord(id)),
  getConcurrency([ConcurrencyType.db]),
);
```

No cap (or cap ≥ length) → degrades to a plain `Promise.all`. `getConcurrency` is the natural source of the cap. Pass thunks, not already-started promises — `resolveAll([p1, p2])` would run everything immediately and defeat the limit.

---

## Distributed Lock (`createLock`)

`@template/db`. Single-node Redis lock with heartbeat. See [REDIS.md](./REDIS.md#distributed-locks) for the full API and footguns.

```ts
import { createLock } from '@template/db';

const lock = createLock({
  service: 'botSession',
  identifier: botId,
  onLockLost: () => closeBotSession(botId),
});
const held = await lock.acquire();
if (!held) throw new Error(`Bot ${botId} owned by another instance`);
try {
  /* critical work */
} finally {
  await lock.release();
}
```

Use when multiple processes can race for the same resource (multiple golem instances both wanting to own the same bot session, multiple workers wanting to run a singleton cron, etc.).

**Inside a transaction, release at the end of the transaction, not the critical section.** A lock that guards a check-then-write must stay held until that write commits, or the next holder checks against state from before it. `db.withLockUntilSettled(lockOptions, fn)` holds a `createLock` lock until the open transaction settles, joins a key the transaction already holds instead of waiting on itself, and runs the transaction's own holders of the key one at a time (the lock + serialized-queue pair above, scoped to the transaction). `withOwnerLock` switches to it whenever it runs inside a transaction, which is how a `transactionAll` batch's sub-requests keep the owner lock until the batch commits. See [DATABASE.md](./DATABASE.md#redis-locks-held-until-the-transaction-ends).

---

## Supersede Lanes (`claimLane` / `watchLane`)

`packages/db/src/lanes/lanes.ts` (exported from `@template/db`). A Redis baton scoped to `(handlerName, dedupeKey)`: the newest claimant wins, and an in-flight older job learns it's been usurped and bows out. Cross-process, the inverse of a lock — a lock keeps the *first* holder and rejects late-comers; a lane hands the baton to the *latest* and evicts the incumbent.

```ts
import { claimLane, watchLane, laneKey } from '@template/db';

const lane = laneKey(handlerName, dedupeKey);
await claimLane(lane, jobId);                 // take the baton (last claim wins)
const stop = watchLane(lane, jobId, () => {   // bow out once a newer job claims it
  abortThisJob();
});
try {
  /* work */
} finally {
  stop();
}
```

`claimLane` writes `jobId` with a TTL (`LANE_TTL_SEC`). `watchLane` polls (`LANE_POLL_MS`, via `heartbeat`) and fires `onUsurped` only when a *different* holder appears — an expired/absent key counts as still held, so a momentary Redis blip doesn't false-trigger. Use for "only the most recent enqueue for this key should finish" (debounced/superseding jobs); see [JOBS.md](./JOBS.md) for the supersede pattern this backs.

---

## Job Lanes (`withLanePriority`)

`apps/api/src/jobs/lanePriority.ts`. Not a lock or a semaphore — an ordering. Slow jobs are added to the shared BullMQ queue at the lowest priority, and BullMQ always takes plain waiting jobs before prioritized ones, so background work only ever runs in slots foreground work isn't using. No slot is reserved; capacity stays shared. This backs the **fast/slow job lanes** — a different thing from the supersede lanes above, which decide *which* job for a key wins. See [JOBS.md § Fast and Slow Lanes](./JOBS.md#fast-and-slow-lanes).

---

## Recurring Beat (`heartbeat`)

`@template/shared/utils/heartbeat`. A self-managing timer that runs `beat` every `intervalMs`, scheduling the next tick only *after* the previous settles — a slow async beat never overlaps itself. Returns `stop()`; no trailing beat fires after stop. Rejections route to `onError` instead of becoming unhandled. In-process.

```ts
import { heartbeat } from '@template/shared/utils';

const stop = heartbeat(async () => {
  await refreshLease();
}, 10_000, { onError: (err) => log.error('beat failed', err) });
// later
stop();
```

This is the primitive under both `createLock` (lease renewal) and `watchLane` (usurp polling). Reach for it directly when you need a non-overlapping recurring task you can cleanly stop — prefer it over a bare `setInterval`, which fires regardless of whether the prior async run finished.

---

## Row Locks (`db.findForUpdate`)

The one way to lock rows. `db.findForUpdate(model, where, { upserting? })` runs `SELECT * ... FOR UPDATE` inside `db.txn()`; `upserting: true` also fences a row that does not exist yet. Full contract: [DATABASE.md § Row Locks and Create-If-Missing](./DATABASE.md#row-locks-and-create-if-missing).

**Exclusive only; there is no shared mode.** No `FOR SHARE`, `FOR KEY SHARE` or `LOCK IN SHARE MODE`, in the primitive or around it. The `no-raw-locks` CI rule fails on raw row-lock SQL anywhere but the primitive, and on a shared lock anywhere ([SCRIPTS.md § CI Rule Scripts](./SCRIPTS.md#ci-rule-scripts)).

**Why.** A shared mode looks like the fix when parallel creates queue on one parent row (let the creates share it, block only its delete). It has been tried: a `shared` option on `findForUpdate` that emitted `FOR SHARE`, plus a call-site helper to hold the parent. The shared hold deadlocked against the exclusive locks taken on other rows in the same writes, and each fix opened a new hole. Letting creates share a row while blocking deletes needs a read/write lock, which this codebase does not have, and a call-site helper only patches that gap. The queueing was a connection-pool problem: with a larger `connection_limit` and a longer `maxWait`, creates wait on the row instead of failing, which is fine at this scale. So when exclusive locks queue, size the pool. Don't add a lock mode: a shared lock beside exclusive ones creates lock orders nobody reasons about.

---

## Cross-references

- [REDIS.md](./REDIS.md) — `createLock` details, namespace conventions
- [JOBS.md](./JOBS.md) — BullMQ workers, supersede pattern (the consumer of `claimLane`/`watchLane`), fast/slow lanes
