# Concurrency

<!-- toc:start -->

## Contents

- [Serialized Queue (`makeSerializedQueue`)](#serialized-queue-makeserializedqueue)
  - [When to use](#when-to-use)
  - [When NOT to use](#when-not-to-use)
  - [Error model](#error-model)
  - [Implementation](#implementation)
- [Concurrency Limits (`minimumConcurrencyLimitFor`)](#concurrency-limits-minimumconcurrencylimitfor)
- [Bounded Batch (`runAllWithConcurrencyLimit`)](#bounded-batch-runallwithconcurrencylimit)
- [Distributed Lock (`makeLock`)](#distributed-lock-makelock)
- [Supersede Lanes (`claimLane` / `watchLane`)](#supersede-lanes-claimlane--watchlane)
- [Job Lanes (`withLanePriority`)](#job-lanes-withlanepriority)
- [Recurring Beat (`startHeartbeat`)](#recurring-beat-startheartbeat)
- [Row Locks (`db.findForUpdate`)](#row-locks-dbfindforupdate)
- [Cross-references](#cross-references)

<!-- toc:end -->

Mechanisms for coordinating async operations. Different concerns, different tools.

| Concern | Tool | Scope |
|---|---|---|
| Cap parallelism (don't open 1000 DB connections at once) | `minimumConcurrencyLimitFor` + `ConcurrencyType` | in-process |
| Run a batch with a concurrency cap, get ordered results | `runAllWithConcurrencyLimit` | in-process |
| Serialize writes to one resource (no interleaving) | `makeSerializedQueue` | in-process |
| Lock rows you read and then write inside a transaction | `db.findForUpdate` | in-transaction (Postgres row lock) |
| Only one process owns this resource | `makeLock` | cross-process (Redis) |
| Newest job for a key wins; older ones bow out | `claimLane` / `watchLane` | cross-process (Redis) |
| Background work yields to foreground work in one shared queue | job lanes (`withLanePriority`) | cross-process (BullMQ priority) |
| Run a recurring beat without overlapping itself | `startHeartbeat` | in-process timer |

The ordering and mutual-exclusion primitives — `makeSerializedQueue`, `makeLock` and `claimLane` / `watchLane` — carry the atlas tag `mutex`: `bunx atlas query --partOf mutex` lists them.

Combine when needed: a per-resource Redis lock + a per-resource serialized queue is the canonical pair for "one instance owns this AND that instance serializes its own writes" — `makeLock` to claim ownership, `makeSerializedQueue` to order that owner's writes.

---

## Serialized Queue (`makeSerializedQueue`)

`@template/shared/utils/serializedQueue`. Per-instance promise chain — each `run(fn)` waits for the previous to settle before invoking. In-process only.

```ts
import { makeSerializedQueue } from '@template/shared/utils';

const queue = makeSerializedQueue();

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

- Need to cap parallelism but allow N in flight → `minimumConcurrencyLimitFor`
- Multiple processes can race for the resource → `makeLock` (or both)
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

## Concurrency Limits (`minimumConcurrencyLimitFor`)

`@template/shared/utils/concurrency`. Pre-defined caps for different resource classes (db, redis, queue, socket, etc.). Pass to `Promise.all`-style batches or BullMQ workers.

```ts
import { minimumConcurrencyLimitFor, ConcurrencyType } from '@template/shared/utils';

const limit = minimumConcurrencyLimitFor([ConcurrencyType.db, ConcurrencyType.integration]);
// limit = min(10, 5) = 5
```

Use when you'd otherwise blow through a connection pool or rate limit.

---

## Bounded Batch (`runAllWithConcurrencyLimit`)

`@template/shared/utils/runAllWithConcurrencyLimit`. `Promise.all` with an optional concurrency cap. Takes an array of thunks (`() => Promise<T>`) rather than promises, so it controls *when* each starts. Results come back in input order regardless of completion order.

```ts
import { runAllWithConcurrencyLimit, minimumConcurrencyLimitFor, ConcurrencyType } from '@template/shared/utils';

const results = await runAllWithConcurrencyLimit(
  ids.map((id) => () => fetchRecord(id)),
  minimumConcurrencyLimitFor([ConcurrencyType.db]),
);
```

No cap (or cap ≥ length) → degrades to a plain `Promise.all`. `minimumConcurrencyLimitFor` is the natural source of the cap. Pass thunks, not already-started promises — `runAllWithConcurrencyLimit([p1, p2])` would run everything immediately and defeat the limit.

---

## Distributed Lock (`makeLock`)

`@template/db` (`packages/db/src/lock/makeLock.ts`; options and return types in `packages/db/src/lock/types.ts`). Single-node Redis lock with heartbeat. Its footguns:

- It is not Redlock: don't rely on it across Redis cluster nodes.
- A holder suspended longer than `ttlMs` (debugger pause, OS sleep) loses the key to the next holder and wakes up believing it still holds it. Keep `ttlMs` well above any pause you expect.
- `verify()` is point-in-time: it reads Redis on every call and answers true only while every key holds this lock's token (there is no local loss latch before `release()`). For exactly-once effects, fence at the resource as well.

`heartbeat: false` makes a one-shot claim (`acquire()` returns `{ claimed, holder }`) that is never renewed and expires at its TTL. A `{ service, identifier }` target is keyed under the `lock:*` namespace ([REDIS.md](./REDIS.md#job-coordination-job-lock)); a `{ key }` target is used as given. A `{ service, identifiers: [...] }` target is one lock over several keys: one token, one heartbeat, one release ([DATABASE.md](./DATABASE.md#redis-locks-held-until-the-transaction-ends)); a claim takes a single key only.

```ts
import { makeLock } from '@template/db';

const lock = makeLock({
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

`acquire({ waitMs, pollMs, onTimeout })` keeps trying until it wins or `waitMs` runs out, first after 1 ms and then doubling up to `pollMs` (default 50 ms), so a lock held for a few milliseconds is taken over within a millisecond or two of its release; a timed-out wait throws `onTimeout()` if given, else returns false. `heartbeatMs` must leave room for one failed refresh before `ttlMs` (`2 * heartbeatMs < ttlMs`, checked at construction); `maxSafeHeartbeatMs({ ttlMs })` is the tighter ceiling that also budgets the Redis command timeout. `isWithinLease()` is the local lease check, and `assertHeld()` throws `LockLostError` once it is false (the API answers 409). `release()` resolves to `released`, `notHeld` (the key, or any key of a set, was no longer this lock's) or `unconfirmed` (the delete errored; the key frees at its TTL).

Use when multiple processes can race for the same resource (multiple golem instances both wanting to own the same bot session, multiple workers wanting to run a singleton cron, etc.).

**Inside a transaction, release at the end of the transaction, not the critical section.** A lock that guards a check-then-write must stay held until that write commits, or the next holder checks against state from before it. `db.withLockUntilSettled(lockOptions, fn)` holds a `makeLock` lock until the open transaction settles, joins a key the transaction already holds (including one an upserting `findForUpdate` took) instead of waiting on itself, and runs the transaction's own holders of the key one at a time (the lock + serialized-queue pair above, scoped to the transaction). A holder whose turn comes after the transaction settled throws instead of running. `withOwnerLock` switches to it whenever it runs inside a transaction, which is how a `transactionAll` batch's sub-requests keep the owner lock until the batch commits. Its scopes are one per owner-wide invariant: `rules` (an owner's rule graph) and `entitlements` (a holder's set of entitlement rows, held by `changeEntitlements` so two writers on one target can't race: each reads the rows the other committed before it checks and writes). See [DATABASE.md](./DATABASE.md#redis-locks-held-until-the-transaction-ends).

---

## Supersede Lanes (`claimLane` / `watchLane`)

`packages/db/src/lanes/lanes.ts` (exported from `@template/db`). A Redis baton scoped to `(handlerName, dedupeKey)`: the newest claimant wins, and an in-flight older holder learns it has been superseded and bows out. Cross-process, the inverse of a lock: a lock keeps the *first* holder and rejects late-comers; a lane hands the baton to the *latest* and evicts the incumbent.

Every call takes a `LaneStore`: the Redis connection, where each holder's own record lives (`holderKeyPrefix`), and the field on that record that says who superseded it (`supersededField`). The lane writes no key of its own beyond the baton. The superseded fact goes on the displaced holder's record and is deleted with it, so nothing outlives the holder. Jobs use `jobLaneStore` (`apps/api/src/jobs/jobLaneStore.ts`): the queue's Redis, BullMQ job hashes, field `supersededBy`. The lane must run on the same Redis as the records it marks; a lane script cannot see a key on another instance.

```ts
import { claimLane, laneKey, markDisplacedHolder, watchLane } from '@template/db';

const lane = laneKey(handlerName, dedupeKey);
const previous = await claimLane(store, lane, jobId);    // take the baton (last claim wins)
await queue.add(handlerName, data, { jobId });          // the new holder must exist first
await markDisplacedHolder(store, lane, jobId, previous); // then mark the one it displaced
const stop = watchLane(store, { lane, holderId: jobId }, () => abortThisJob());
```

- `claimLane` only takes the baton, with a TTL covering the job's delay (`LANE_TTL_SEC` plus the delay).
- `markDisplacedHolder` runs once the new holder exists. While the lane still names it, the displaced holder's record gets the field; if a newer claim that exists got there first, the new holder marks itself. It never creates a record that does not exist.
- A failed add throws and leaves nothing to undo: no mark was written, and a baton naming a holder with no record counts as no holder.
- `claimLaneUnlessNewerHolder` takes the baton unless a newer holder that exists holds it (holder ids are uuidv7, so a string compare is an age compare). A job's start and the outbox drain use it.
- `watchLane` polls (`LANE_POLL_MS`) in one script: it fires when the holder's record says it was superseded, when its parent's record does (copying the superseder onto its own record so its own children stop), or when another holder with a record takes the lane. Otherwise it refreshes its own baton, and its parent's while the parent still holds it.
- `holdLaneWhileParked` stretches a parked holder's baton to `PARKED_LANE_TTL_SEC` (3 hours). Nothing in a lane lives longer without a refresh.

Use it for "only the most recent enqueue for this key should finish". Jobs that use it must be safe to re-run: see [JOBS.md § Superseding Job](./JOBS.md#superseding-job). Lane scripts touch the holder's record without declaring it, so they need a standalone Redis, not Redis Cluster.

---

## Job Lanes (`withLanePriority`)

`apps/api/src/jobs/lanePriority.ts`. Not a lock or a semaphore — an ordering. Slow jobs are added to the shared BullMQ queue at the lowest priority, and BullMQ always takes plain waiting jobs before prioritized ones, so background work only ever runs in slots foreground work isn't using. No slot is reserved; capacity stays shared. This backs the **fast/slow job lanes** — a different thing from the supersede lanes above, which decide *which* job for a key wins. See [JOBS.md § Fast and Slow Lanes](./JOBS.md#fast-and-slow-lanes).

---

## Recurring Beat (`startHeartbeat`)

`@template/shared/utils/startHeartbeat`. A self-managing timer that runs `beat` every `intervalMs`, scheduling the next tick only *after* the previous settles — a slow async beat never overlaps itself. Returns `stop()`; no trailing beat fires after stop. Rejections route to `onError` instead of becoming unhandled. In-process.

```ts
import { heartbeat } from '@template/shared/utils';

const stop = startHeartbeat(async () => {
  await refreshLease();
}, 10_000, { onError: (err) => log.error('beat failed', err) });
// later
stop();
```

This is the primitive under both `makeLock` (lease renewal) and `watchLane` (usurp polling). Reach for it directly when you need a non-overlapping recurring task you can cleanly stop — prefer it over a bare `setInterval`, which fires regardless of whether the prior async run finished.

---

## Row Locks (`db.findForUpdate`)

The one way to lock rows. `db.findForUpdate(model, where, { upserting?, changesKey? })` runs `SELECT * ... FOR NO KEY UPDATE` inside `db.txn()`; `upserting: true` also fences a row that does not exist yet. Full contract: [DATABASE.md § Row Locks and Create-If-Missing](./DATABASE.md#row-locks-and-create-if-missing).

**What the lock holds off.** `FOR NO KEY UPDATE` is the lock a plain `UPDATE` takes. Every other locker, updater and deleter of the row waits. An insert of a row that *references* the locked row does not wait: its foreign-key check takes `KEY SHARE`, which this lock allows. That is deliberate. Under `FOR UPDATE` such an insert waited, so a transaction that inserted children while another walked a chain of locked parents could deadlock, and unrelated creates queued behind any held parent. A transaction that counts or reads a parent's children and relies on none appearing must have every writer of those children take the same lock first; the lock alone no longer keeps them out.

**`changesKey: true`** takes `FOR UPDATE`. Use it only when the transaction will delete the row or change a column other rows reference (the primary key, or a unique column a foreign key targets), as `transferSpace` does to `Space.organizationId`. Postgres would upgrade the lock at that write anyway; taking it up front keeps a child insert from slipping in between and deadlocking the upgrade.

**Exclusive only; there is no shared mode.** No `FOR SHARE`, `FOR KEY SHARE` or `LOCK IN SHARE MODE`, in the primitive or around it. The `no-raw-locks` CI rule fails on raw row-lock SQL anywhere but the primitive, and on a shared lock anywhere ([SCRIPTS.md § CI Rule Scripts](./SCRIPTS.md#ci-rule-scripts)).

**Why.** A shared mode looks like the fix when parallel creates queue on one parent row (let the creates share it, block only its delete). It has been tried: a `shared` option on `findForUpdate` that emitted `FOR SHARE`, plus a call-site helper to hold the parent. The shared hold deadlocked against the exclusive locks taken on other rows in the same writes, and each fix opened a new hole. Letting creates share a row while blocking deletes needs a read/write lock, which this codebase does not have, and a call-site helper only patches that gap. The queueing was a connection-pool problem: with a larger `connection_limit` and a longer `maxWait`, creates wait on the row instead of failing, which is fine at this scale. So when exclusive locks queue, size the pool. Don't add a lock mode: a shared lock beside exclusive ones creates lock orders nobody reasons about.

---

## Cross-references

- [REDIS.md](./REDIS.md) — namespace conventions, including the `lock:*` keys `makeLock` writes
- [JOBS.md](./JOBS.md) — BullMQ workers, supersede pattern (the consumer of `claimLane`/`watchLane`), fast/slow lanes
