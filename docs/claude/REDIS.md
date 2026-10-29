# Redis

<!-- toc:start -->

## Contents

- [Connection Management](#connection-management)
  - [Connection Strategy](#connection-strategy)
  - [Why Separate Connections?](#why-separate-connections)
- [Namespaces](#namespaces)
  - [Current Namespaces](#current-namespaces)
- [Built-In Uses](#built-in-uses)
  - [Cache (`cache:*`)](#cache-cache)
  - [Sessions (`session:*`)](#sessions-session)
  - [Rate Limiting (`limit:*`)](#rate-limiting-limit)
  - [Job Coordination (`job:*`, `lock:*`)](#job-coordination-job-lock)
  - [Supersede Lanes (`lane:*`)](#supersede-lanes-lane)
  - [WebSocket Pub/Sub (`ws:*`)](#websocket-pubsub-ws)
  - [BullMQ (`bull:*`)](#bullmq-bull)
- [Cache Utilities](#cache-utilities)
  - [cacheKey() Builder](#cachekey-builder)
  - [cache() Get-or-Set](#cache-get-or-set)
  - [checkCache()](#checkcache)
  - [clearKey()](#clearkey)
  - [Automatic Invalidation](#automatic-invalidation)
    - [Invalidation conventions](#invalidation-conventions)
  - [Rolling Caches](#rolling-caches)
- [Testing](#testing)
  - [In-Memory Mock](#in-memory-mock)
  - [Test Isolation](#test-isolation)
  - [Queue Mock](#queue-mock)
- [Error Handling](#error-handling)
  - [Connection Errors](#connection-errors)
  - [Cache Fallback](#cache-fallback)
  - [Key Validation](#key-validation)

<!-- toc:end -->


---

## Connection Management

Located in `packages/db/src/redis/`.

### Connection Strategy

| Connection | Purpose | Notes |
|------------|---------|-------|
| Main (`getRedisClient`) | All regular operations | Cache, rate limits, sign-in handshake sessions, OTP |
| Subscriber (`getRedisSub`) | Pub/sub subscriptions | `SUBSCRIBE` is blocking, needs own connection |
| Publisher (`getRedisPub`) | Pub/sub publishing | Shares main client (publish doesn't block) |
| BullMQ | Job queues | Manages own connections via `createRedisConnection` |

```typescript
import { getRedisClient, getRedisPub, getRedisSub, createRedisConnection } from '@template/db';

// Regular operations
const redis = getRedisClient();
await redis.get('key');

// WebSocket pub/sub
const pub = getRedisPub();
const sub = getRedisSub();

// BullMQ creates its own
const bullConnection = createRedisConnection('Redis:BullMQ:Worker');
```

### Why Separate Connections?

- **Subscriber isolation**: `SUBSCRIBE` puts connection in pub/sub mode - can't run other commands
- **BullMQ requirement**: Queue and Worker need separate connections for reliability
- **Single main client**: All non-blocking operations share one connection (efficient)

---

## Namespaces

All Redis keys must use namespaces from `packages/db/src/redis/namespaces.ts`:

```typescript
import { redisNamespace } from '@template/db';

// Good
const key = `${redisNamespace.cache}:User:${id}`;
const lockKey = `${redisNamespace.job}:lock:${jobId}`;

// Bad - hardcoded prefixes
const key = `cache:User:${id}`;  // Don't do this
```

### Current Namespaces

| Namespace | Prefix | Purpose |
|-----------|--------|---------|
| `bull` | `bull:*` | BullMQ job queues (managed by BullMQ) |
| `cache` | `cache:*` | Application cache (user lookups, tokens, etc.) |
| `job` | `job:*` | Job-system state: overflow flags (`job:overflow`), the slow lane's deferral list and idle clock |
| `ws` | `ws:*` | WebSocket pub/sub channels and data-stream seq counters (`ws:seq:{<stream>}`) |
| `otp` | `otp:*` | One-time passwords / verification codes |
| `session` | `session:*` | BetterAuth sign-in handshake sessions and one-time tokens (via secondaryStorage) |
| `limit` | `limit:*` | Rate limiting counters |
| `lock` | `lock:*` | Distributed locks via `createLock` |
| `lane` | `lane:*` | Supersede lane batons via `claimLane`/`watchLane`, and per-job tombstones (`lane:superseded:<jobId>`) |
| `cacheWritten` | `cachewritten:*` | When the value under a `cache:` key was written (epoch ms); set and cleared with the value, read by `checkCache` |
| `cacheGeneration` | `cachegen:*` | A `cache:` key's generation (`cachegen:<key>`) and the cache-wide epoch (`cachegen:epoch`); a clear moves them so a compute in flight skips its publish |
| `cacheQueued` | `cachequeued:*` | A rolling-cache target whose refresh is enqueued and has not taken its lock; read by `checkCache` as `queued` |
| `rollingCache` | `rollingcache:*` | Rolling-cache timers (`rollingcache:timer:<name>`), kept out of `cache:` so a flush never reschedules a refresh |

---

## Built-In Uses

### Cache (`cache:*`)

Application data caching with TTL. See [Cache Utilities](#cache-utilities).

```typescript
// Token lookup by hash (use object for non-ID fields)
cacheKey('token', { keyHash })         // → cache:token:keyHash:abc123

// User by email
cacheKey('user', { email })            // → cache:user:email:foo@example.com
```

### Sessions (`session:*`)

BetterAuth's `secondaryStorage` (in `apps/api/src/lib/auth.ts`). It holds only the sign-in handshake: a session lives at most 10 minutes and `jwtHandoff` deletes it as soon as it hands out the person's JWT, plus the 1-minute OAuth one-time tokens. No request outside `/api/auth` reads it ([AUTH.md](./AUTH.md#what-lives-where)).

```typescript
// In lib/auth.ts
secondaryStorage: {
  get: (key) => redis.get(`${redisNamespace.session}:${key}`),
  set: (key, value, ttl) => redis.setex(`${redisNamespace.session}:${key}`, ttl, JSON.stringify(value)),
  delete: (key) => redis.del(`${redisNamespace.session}:${key}`),
  getAndDelete: (key) => redis.getdel(`${redisNamespace.session}:${key}`),
}
```

### Rate Limiting (`limit:*`)

Fixed windows, one atomic Lua `INCR` + first-hit `PEXPIRE` per rule (`incrementFixedWindows`).
A `rateLimit(rules)` middleware ANDs its rules — every bucket must be under its max — and 429s
with `Retry-After`. Redis down = fail open (warn + report, request allowed).

```typescript
// `${redisNamespace.limit}:${scope}:${windowMs}:${identity}`
`limit:api:principal:1000:user:${userId}`        // session, or any token owned by / through the user
`limit:api:principal:1000:ip:${clientIp}`        // anonymous fallback
`limit:api:space:1000:space:${spaceId}`          // Space / SpaceUser tokens
`limit:api:organization:1000:organization:${organizationId}`
`limit:auth:60000:ip:${clientIp}`                // /api/auth/* per IP
```

Lua scripts are queries: each lives in its module's `queries/` folder (`lanes/queries/`, `lock/queries/`,
`middleware/rateLimit/queries/`), one script plus the function that evals it per file — the
`lua-in-queries` CI rule holds the line.

These are **identity** limits — abuse protection keyed on who is calling. A batch's sub-requests
are not counted (the batch request paid once; the skip keys on the registry-resolved batch
transaction, not the spoofable `x-batch-id` header). A **cost** limit — AI calls, anything that bounds
spend — is a separate detector that must still run inside a batch; it is not an `apiRateLimit` rule.

Identity comes from the session user or the token (its user, its organization and space keys), the IP from the trusted
`x-forwarded-for` hop bucketed to /64 (`clientIp`). Maxes resolve through `rateLimitMax(tier, c)`,
the seam for subscriptions / feature flags (INFRA-027) — never a column on Token, Organization or Space.

### Job Coordination (`job:*`, `lock:*`)

Singleton job locks are `createLock` locks on the queue's connection; BullMQ deduplication
(`deduplication: { id: <handler>-<key> }`) keeps a second job for the same key from being added at all
(see [JOBS.md](JOBS.md#singleton-job)):

```typescript
// Singleton job lock (prevents concurrent runs): keyed by lockKey(payload), else the cron row id
`${redisNamespace.lock}:job-singleton:${handlerName}:${key}`
`${redisNamespace.lock}:job-singleton:${cronJobId}`
```

### Supersede Lanes (`lane:*`)

Last-claim-wins batons for superseding jobs (`claimLane`/`watchLane`, in `@template/db`):

```typescript
// Superseding lane (holds the current holder's jobId; a different holder means the prior job was usurped)
`${redisNamespace.lane}:${handlerName}:${dedupeKey}`
```

### WebSocket Pub/Sub (`ws:*`)

Cross-server WebSocket broadcasting:

```typescript
// Pub/sub channel for all WS messages
const WS_CHANNEL = 'ws:broadcast';

// Messages include type: 'channel' | 'broadcast'
await pub.publish(WS_CHANNEL, JSON.stringify({ type: 'channel', target: 'org:123', event }));
```

Stream appends are published by a Lua script that also `INCR`s the stream's `ws:seq:{<stream>}`
counter, so every instance shares one sequence per stream (see
[WEBSOCKETS.md](WEBSOCKETS.md#sequence-numbers)).

### BullMQ (`bull:*`)

Managed by BullMQ internally. Queue name is `jobs`:

```typescript
// BullMQ keys look like:
// bull:jobs:waiting
// bull:jobs:active
// bull:jobs:completed
// bull:jobs:failed
```

---

## Cache Utilities

Located in `packages/db/src/redis/cache/`, one file per behaviour: `cache.ts`, `checkCache.ts`,
`clearKey.ts`, `upsertCache.ts`, with `generation/` (clear cancels in-flight work), `queued/` (the
rolling-cache queued marker), `queries/` (the Lua scripts, each a typed function over `RedisEval`),
`telemetry/` and `rollingCache/`. The single-flight lock is a lock, so it lives in
`packages/db/src/lock/singleFlight/`.

### cacheKey() Builder

Standard key format: `cache:{accessor}:{field}:{value}[:{tags}][:{*}]`

```typescript
import { cacheKey } from '@template/db';

// String identifier = lookup by id
cacheKey('user', 'abc-123')                              // cache:user:id:abc-123

// Object identifier = lookup by specified field(s)
cacheKey('user', { email: 'foo@example.com' })           // cache:user:email:foo@example.com

// Composite key (sorted alphabetically)
cacheKey('organizationUser', { userId: 'u1', organizationId: 'o1' })
  // → cache:organizationUser:organizationId:o1:userId:u1

// With tags
cacheKey('user', 'abc-123', ['WithOrgs'])                // cache:user:id:abc-123:WithOrgs

// With wildcard
cacheKey('session', { userId: 'abc-123' }, [], true)     // cache:session:userId:abc-123:*
```

### cache() Get-or-Set

```typescript
import { cache } from '@template/db';

const user = await cache(
  cacheKey('User', id),
  async () => db.user.findUnique({ where: { id } }),
  60 * 60  // Optional TTL (default: 24 hours)
);
```

Behavior:
- Returns cached value if exists (including `null`/`undefined`)
- Computes via fn() on cache miss; concurrent misses on one key compute once (single-flight)
- **Negative caching**: `null`/`undefined` cached with 1 min TTL (prevents thundering herd, allows quick discovery of new records)
- Real values cached with provided TTL (default 24 hours)
- **A clear cancels the publish.** The compute captures the key's generation and the cache epoch
  before `fn` runs and publishes only if neither moved. A value read before a `clearKey` or an
  `upsertCache` is returned to its caller but never lands in the cache. Without the lock or the
  generation (Redis failing) the value is returned unpublished.

Telemetry: each call opens a `cache <accessor>` span labelled with its result, and reads count into
`cache.read` by accessor and result (`hit`, `miss`, `error`). A single-flight wait is timed into
`cache.lock.wait`; a publish skipped because a clear ran counts into `cache.publish.skipped`. Every
tag is the accessor, never the key, so cardinality stays bounded.
### checkCache()

Read a key without computing it. Every write (`cache`, `upsertCache`) stores the write time beside the
value (`cachewritten:<key>`, same TTL, same Lua eval), and an exact `clearKey` deletes both:

```typescript
import { checkCache } from '@template/db';

const check = await checkCache<Stats>(key, { freshForSeconds: 600 });
// { state: 'empty' }        nothing written, nobody computing, nothing queued
// { state: 'queued' }       nothing written yet, a refresh is enqueued and has not taken the lock
// { state: 'computing' }    nothing written yet, the key's single-flight lock is held
// { state: 'fresh' | 'stale', value, writtenAt, isComputing, isQueued }
```

`computedUnder` names a different single-flight lock to report `computing` from (a rolling cache
passes its target's key, so every result of one target computes under one lock). `singleFlightLock(key)`
is that lock, exported for a writer that computes outside `cache()`. A Redis failure throws rather
than reading as empty, so a caller that queues work on a miss doesn't pile work onto an outage.

### clearKey()

Clear cache entries - supports exact keys and wildcard patterns:

```typescript
import { clearKey } from '@template/db';

// Exact key
await clearKey('cache:User:id:123');

// Wildcard pattern (uses SCAN, non-blocking)
await clearKey('cache:User:*');
```

A clear also cancels computes in flight. An exact clear deletes the value and its write time and moves
the key's generation in one Lua call; a pattern clear moves the cache-wide epoch before it scans.
Either way a `cache()` compute that read before the clear skips its publish, and the next caller
recomputes. To drop one value you know is bad (a token the vendor rejected), read it with `checkCache`
and clear only if it is still that value: if a recompute is already running the key is empty, so the
clear is skipped and the caller's next `cache()` waits on the running one. A failed exact clear logs and returns 0; a failed pattern clear throws, because the caller
cannot tell which of its keys survived.

### Automatic Invalidation

Cache keys defined in the cache reference map are auto-cleared on mutations via an after-commit db hook. See [HOOKS.md - Cache Invalidation](./HOOKS.md#cache-invalidation).

#### Invalidation conventions

Correctness here is enforced by **discipline and tests, not by types** — nothing compiler-checks that a mutation clears the right keys. These rules are what keep it correct:

- **Reverse-reference map.** The map answers "given this changed record, which keys is it reachable by?" — so a write becomes a key *lookup*, not a search. Per cached model, return every key the record is read under (id, value lookups, and cross-entity tag keys).
- **One canonical key, or it drifts.** Always build keys with `cacheKey`, never hand-format. The domain (model/accessor) is normalized to the accessor, so a write keyed `'User'` and a clear keyed `'user'` resolve to the *same* key. Hand-built or differently-cased keys silently skip invalidation (Redis keys are case-sensitive).
- **One tool, every surface — kept sound by Previous ∪ Result.** The data is read under several surfaces (id, value lookups like email/slug, relationship/tag keys) — don't restrict to id-only or relation-only; build keys with the one `cacheKey` tool across all of them. Value keys move with the record, so the hook clears keys derived from **both** the previous and result rows — a value change drops its *old* key too. The tool matches the problem's surfaces; P∪R is what makes the value surfaces correct.
- **Invalidate on structure, not payload.** A record's payload change and its *linkage* change are different events. A payload update may *read* a relationship-reach cache (e.g. to fire a webhook); only a link change (a `CustomerRef`/subscription mutation) should *bust* it. Express this with different key sets per entry — e.g. `User` clears `user:id` but not `user:…:customerRefs`; only `CustomerRef` clears the linkage.
- **Know what *not* to cache.** A read whose correct invalidation needs a relationship/graph walk (webhook subscriptions reached via `customerRef`) is fetched fresh, or cached only on the slow-moving *linkage* side. Caching it by affected-model can't be invalidated correctly — a missed clear is a stale read served silently.
- **Tests are the enforcement.** Because none of the above is compiler-checked, every cached entity needs a read-after-write test (cache under the call-site key → mutate → assert cleared). That test catches drift; nothing else does.

### Rolling Caches

A value computed from stored data only to serve it fast — a count, a rollup, a picker vocabulary read
on every load — is a **rolling cache**, not a table. A table of materialized values needs hand-written
invalidation for every way its inputs change, and each one missed is a stale read nobody notices. A
rolling cache recomputes on a fixed interval, and its entries outlive the longest a refresh can take,
every retry included, so a read always hits. There is no invalidation to write.

One definition declares its **input** (`targets`: what one refresh is for), its **outputs**
(`results`: every entry a refresh fills, each a function returning that entry's key) and the **job**
(`compute`: one pass that writes its results):

```typescript
import { cacheKey, db, makeRollingCache } from '@template/db';
import { WS_CHANNELS } from '@template/shared/ws';

export const spaceStats = makeRollingCache({
  name: 'spaceStats',                           // unique; a second registration throws
  intervalSeconds: 3600,                        // at least 300 (five coordinator ticks)
  targets: { model: 'Organization', args: { select: { id: true } } },
  results: {
    total: ({ id }) => cacheKey('spaceStats', id, ['total']),
    byName: ({ id, name }: { id: string; name: string }) =>
      cacheKey('spaceStats', { organizationId: id, name }, ['byName']),
  },
  compute: async ({ id }, { results, write, signal }) => {
    const spaces = await db.space.findMany({ where: { organizationId: id } });
    signal?.throwIfAborted();
    await write(results.total({ id }), spaces.length);
    for (const { name } of spaces) await write(results.byName({ id, name }), 1);
  },
  channel: ({ id }) => WS_CHANNELS.someRead.name(id), // optional: announce refreshes
});

// api (apps/api/src/jobs/checkRollingCache.ts): name the result and pass its params; never build a key
const check = await checkRollingCache(spaceStats, 'total', { id: organizationId });
// → { state: 'empty' | 'queued' | 'computing' | 'fresh' | 'stale', value?, writtenAt?, isComputing?, isQueued?, channel? }
```

- **Define it inline**, in the module that owns the data
  (`packages/db/src/redis/cache/rollingCache/makeRollingCache.ts` is the primitive). It registers itself on import, like a factory.
- **Register the module** in `apps/api/src/lib/rollingCaches.ts` (import-only). The worker imports
  that barrel and its coordinator refreshes every registered cache; the `rolling-cache-registered`
  CI rule fails a definition missing from it.
- **`targets` is `{ model, args }`**, where `args` is that model's own Prisma `findMany` args — no
  shorthand of our own. Each returned row is one refresh job's payload and the argument to
  `compute`, typed by your `select`; select JSON-scalar columns, since the row crosses the queue as
  JSON (a BigInt throws, a Date arrives as a string). `distinct` is a real `DISTINCT` on Postgres.
  Resolution fails closed above `MAX_ROLLING_CACHE_TARGETS` (10,000) rather than refreshing a
  partial list. A cache with one value for the whole system omits `targets`; its result functions
  take no params.
- **Result params are one object** holding the target's selected fields plus whatever names the
  entry. `targetOf(params)` picks the `select: true` fields back out, so a reader can queue the
  target's refresh from what it already has. `targetKey(target)` (cache name + sorted target fields)
  is the target's identity: the leaf's supersede key and its single-flight lock.
- **Every result of a target is computed by one job, under one lock.** Don't split a pass that reads
  the same rows into two caches; give one cache two results.
- **Four times.** `intervalSeconds` is how often a target is refreshed. `spreadSeconds` (default: half
  the interval, whole, less than the interval) is the window a branch spreads its leaves' starts
  across. `timeoutSeconds` (default: one interval) is how long one leaf attempt may run before it
  reports itself stuck. `ttlSeconds` (default: interval × (`ROLLING_CACHE_LEAF_ATTEMPTS` + 2)) is how
  long an entry lives; registration throws unless it is longer than interval + spread + every
  attempt × timeout + one tick.
- **A read never computes.** `read(result, params)` is `checkCache` on that result's key: `empty`,
  `queued` (a refresh is enqueued), `computing` (the target's lock is held), `fresh`, or `stale`
  (older than one scheduled refresh, with `isComputing` and `isQueued` beside it).
  `checkRollingCache` (`apps/api/src/jobs/checkRollingCache.ts`) is the api read: on `empty`, or
  `stale` with nothing computing or queued, it sets the target's queued marker and, only if it set
  it, enqueues the target's leaf, so N cold readers send one job. A failed enqueue clears the marker.
  It reads again and returns the cache's `channel` so a client knows where to wait.
- **`refresh(target)`** waits up to `timeoutSeconds` for the target's lock (else returns false), runs
  `compute` once, and holds the lock until the last write lands. `write` is `upsertCache` with
  `force` and the cache's TTL; a write after `signal` aborted is dropped, and a failed write throws so
  the leaf retries. `compute` gets the signal: check it between batches. An abort releases the lock
  at once, and a refresh whose signal aborted while it waited for the lock releases it without
  computing, so the refresh that superseded it does not wait on a compute whose writes are dropped. A
  refresh that wrote clears the target's queued marker; an aborted one leaves it for its retry, and a
  leaf that fails its last attempt clears it so the next reader can queue again.
- **Warm on boot.** The worker enqueues every registered cache's branch when it starts
  (`apps/api/src/jobs/warmRollingCaches.ts`), so a deploy that changed result keys is not cold until
  the next interval.
- **A written value is never null or undefined**: `cache()` keeps null for only a minute and reads
  undefined as a miss. Write an empty value of the shape instead.
- `getRollingCache(name)` throws for a name nothing registered; tests that define their own cache
  remove it with `unregisterRollingCache`.

Scheduling (root, branch and leaf jobs) is in [JOBS.md](JOBS.md#rolling-caches-root-branch-leaf).


---

## Testing

### In-Memory Mock

In test environment, all Redis operations use a shared in-memory mock:

```typescript
// In packages/db/src/redis/client.ts
if (isTest) {
  if (!__mock) __mock = new RedisMock() as unknown as Redis;
  return __mock;
}
```

All connections (`getRedisClient`, `getRedisSub`, `createRedisConnection`) return the same mock instance.

### Test Isolation

```typescript
import { flushRedis } from '@template/db';

beforeEach(async () => {
  await flushRedis();  // Clear all keys between tests
});
```

`flushRedis()` throws if called outside test environment.

### Queue Mock

BullMQ queue is mocked in tests to avoid actual job processing:

```typescript
// tests/mocks/queue.ts
mock.module('#/jobs/queue', () => ({
  queue: {
    add: async (name: string) => ({ id: `mock-${++jobCounter}`, name }),
    getJobs: async () => [],
    redis: getRedisClient(),  // Uses same mock
  },
}));
```

---

## Error Handling

### Connection Errors

```typescript
redis.on('error', (err) => log.error(`[${name}] Error:`, err));
redis.on('connect', () => log.info(`[${name}] Connected`));
```

### Cache Fallback

Cache operations gracefully degrade when Redis is unavailable:

- **Read errors**: Fall through to compute value (Redis down = cache miss)
- **Write errors**: Fire-and-forget with error logging (don't block response)
- **Compute errors**: Propagate normally (not swallowed)

### Key Validation

Cache utilities validate keys to catch bugs early:

```typescript
function validateKey(key: string): void {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
}
```
