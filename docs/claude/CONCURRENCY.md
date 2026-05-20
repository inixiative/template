# Concurrency

Mechanisms for coordinating async operations. Three different concerns, three different tools.

| Concern | Tool | Scope |
|---|---|---|
| Cap parallelism (don't open 1000 DB connections at once) | `getConcurrency` + `ConcurrencyType` | in-process |
| Serialize writes to one resource (no interleaving) | `createSerializedQueue` | in-process |
| Only one process owns this resource | `createLock` | cross-process (Redis) |

Combine when needed: a per-bot Redis lock + a per-bot serialized queue is the canonical pair for "one instance owns this AND that instance serializes its own writes." See `apps/golem-shamash/src/lib/botSession.ts` for the wire-up.

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

Real example — Baileys' Postgres-backed auth adapter (`packages/baileys/src/authState.ts`):
- `keys.set` and `creds.update` both rewrite the entire encrypted blob
- Both fire during normal operation (key rotation, session updates)
- Without the queue, in-memory `stored` would be read+modified by overlapping writes and silently lose data on persist

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

---

## Cross-references

- [REDIS.md](./REDIS.md) — `createLock` details, namespace conventions
- [JOBS.md](./JOBS.md) — BullMQ workers, supersede pattern (a different kind of "only one of these should run" mechanism)
