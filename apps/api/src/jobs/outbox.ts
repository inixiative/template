/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { db, type Prisma, redisNamespace } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';
import { queue } from '#/jobs/queue';
import { type JobData, type JobOptions, JobType } from '#/jobs/types';

// Durable overflow buffer in front of BullMQ. When queue depth crosses a cap an
// "overflow" flag flips and adhoc enqueues spill to the JobOutbox table instead of
// Redis; the drain cron meters them back in. See docs/design/jobs-overflow-buffer.md.

// Config is read lazily (not frozen at import) so it's overridable per process and in tests.
const num = (v: string | undefined, fallback: number): number => (v === undefined ? fallback : Number(v));
export const maxQueueDepth = (): number => num(process.env.JOBS_MAX_QUEUE_DEPTH, 10_000);
export const lowWater = (): number => Math.floor(maxQueueDepth() * 0.8);
const flushMaxRows = (): number => num(process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS, 1000);
const flushLinger = (): number => num(process.env.JOBS_OUTBOX_FLUSH_LINGER_MS, 200);
const overflowStuckMs = (): number => num(process.env.JOBS_OVERFLOW_STUCK_MS, 300_000);
// Flag TTL — a safety net so a dead drain doesn't pin overflow forever; the drain heartbeats it
// (withOverflowRenew) while alive. ms→s for Redis EX.
const overflowTtlSec = (): number => Math.ceil(num(process.env.JOBS_OVERFLOW_TTL_MS, 60_000) / 1000);
const DEPTH_CACHE_MS = 1000;
const SHUTDOWN_FLUSH_RETRIES = 3;

const FLAG_KEY = `${redisNamespace.job}:overflow`;

export type OutboxRow = {
  handlerName: string;
  jobId: string;
  dedupeKey: string | null;
  data: JobData;
  options: JobOptions;
};

const toCreateInput = (row: OutboxRow): Prisma.JobOutboxCreateManyInput => ({
  handlerName: row.handlerName,
  jobId: row.jobId,
  dedupeKey: row.dedupeKey,
  data: row.data as Prisma.InputJsonValue,
  options: row.options as Prisma.InputJsonValue,
});

// Spill routing decision (pure, so it's testable without the queue): adhoc only,
// never when bypassed, only while overflowing. Cron/cronTrigger always go direct.
export const shouldSpill = (type: JobType, bypass: boolean, overflowing: boolean): boolean =>
  type === JobType.adhoc && !bypass && overflowing;

// --- depth probe: counts the waiting backlog + in-flight, NOT `delayed` (which includes
// scheduled cron repeats — a standing floor that isn't overflow pressure). Cached ~1s. ---
let cachedDepth = 0;
let cachedAt = 0;

export const queueDepth = async (fresh = false): Promise<number> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cachedDepth;
  const counts = await queue.getJobCounts('waiting', 'active');
  cachedDepth = (counts.waiting ?? 0) + (counts.active ?? 0);
  cachedAt = now;
  return cachedDepth;
};

// --- the overflow flag (global). Value = epoch ms when overflow began. ---
export const isOverflowing = async (): Promise<boolean> => (await queue.redis.get(FLAG_KEY)) !== null;
// Set-once via NX so re-trips keep the original start time (used by the stuck-overflow alert),
// with a TTL the drain renews each tick — survives between ticks, self-clears if the drain dies.
const setOverflow = (): Promise<unknown> => queue.redis.set(FLAG_KEY, String(Date.now()), 'EX', overflowTtlSec(), 'NX');
export const renewOverflow = (): Promise<unknown> => queue.redis.expire(FLAG_KEY, overflowTtlSec());
export const clearOverflow = (): Promise<unknown> => queue.redis.del(FLAG_KEY);

// Trip the flag inline when a direct add crosses the cap. Fresh probe (not cached): on a ramp the
// stale cache would trip late and let the queue overshoot — and tripIfFull only runs pre-overflow.
export const tripIfFull = async (): Promise<void> => {
  if ((await queueDepth(true)) >= maxQueueDepth()) await setOverflow();
};

// Operational alert: overflow that won't clear means the drain can't keep up with arrivals.
export const warnIfOverflowStuck = async (depth: number): Promise<void> => {
  const startedAt = await queue.redis.get(FLAG_KEY);
  if (startedAt === null) return;
  const ageMs = Date.now() - Number(startedAt);
  if (ageMs > overflowStuckMs()) {
    log.warn(
      `overflow stuck ${Math.round(ageMs / 60_000)}m — drain not keeping up (depth ${depth} ≥ low-water ${lowWater()})`,
      LogScope.job,
    );
  }
};

// Hold the flag's TTL open for the duration of `fn` via a recursive renew (like createLock's
// heartbeat), so a long drain pass can't let it lapse mid-tick regardless of how long it runs —
// no reliance on TTL > tick duration. renewOverflow (EXPIRE) no-ops on an absent key, so the final
// renew never resurrects a flag the pass cleared.
export const withOverflowRenew = async <T>(fn: () => Promise<T>): Promise<T> => {
  const renewMs = Math.floor((overflowTtlSec() * 1000) / 3); // a third of the TTL — always below it by construction
  let timer: ReturnType<typeof setTimeout> | null = null;
  const beat = (): void => {
    timer = setTimeout(() => {
      void renewOverflow().catch(() => {});
      beat();
    }, renewMs);
  };
  beat();
  try {
    return await fn();
  } finally {
    if (timer) clearTimeout(timer);
    await renewOverflow().catch(() => {});
  }
};

// Abort any queued/in-flight job in one of these supersede lanes — ONE queue scan for the whole
// set, so the drain can signal every lane in its batch without re-scanning the queue per row.
export const signalSupersededLanes = async (dedupeKeys: Set<string>): Promise<void> => {
  if (!dedupeKeys.size) return; // no superseding rows → no scan
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'paused']);
  for (const job of jobs) {
    if (!job.id) continue;
    const lane = (job.data as JobData).dedupeKey;
    if (lane && dedupeKeys.has(lane)) {
      await queue.redis.set(`${redisNamespace.job}:superseded:${job.id}`, '1', 'EX', 300);
      log.info(`Signaled job ${job.id} to abort (superseded)`, LogScope.job);
    }
  }
};

// Single-lane convenience for the direct enqueue path.
export const signalSupersededJobs = (dedupeKey: string): Promise<void> => signalSupersededLanes(new Set([dedupeKey]));

// --- accumulator: ALL spills (fan-out AND superseding) coalesce into one batched write ---
type Pending = { row: OutboxRow; resolve: () => void; reject: (e: unknown) => void };

let acc: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let closing = false; // shutdown: stop arming timers — flushOutbox owns the final drain
let lastFlush: Promise<void> = Promise.resolve();

// Shared mutex: every JobOutbox write (accumulator flush AND the drain) runs through this
// serialized queue, so a flush and a drain can never touch the table at the same time.
const flushQueue = createSerializedQueue();
export const runOnOutboxQueue = <T>(fn: () => Promise<T>): Promise<T> => flushQueue.run(fn);

// Within a batch, keep only the latest row per superseding lane; plain (null-dedupeKey) rows all kept.
const dedupeLatestPerLane = (batch: Pending[]): OutboxRow[] => {
  const laneAt = new Map<string, number>();
  const rows: OutboxRow[] = [];
  for (const { row } of batch) {
    if (row.dedupeKey === null) {
      rows.push(row);
      continue;
    }
    const lane = `${row.handlerName} ${row.dedupeKey}`;
    const at = laneAt.get(lane);
    if (at === undefined) {
      laneAt.set(lane, rows.length);
      rows.push(row);
    } else {
      rows[at] = row; // latest wins
    }
  }
  return rows;
};

// Insert the batch in one txn: plain fan-out rows via createMany (jobId-idempotent), superseding
// lanes via upsert. Upsert is last-writer-wins with no silent drop even when two processes flush the
// same lane — `createMany({ skipDuplicates })` would keep whichever COMMITS first, not the latest.
const writeBatch = (batch: Pending[]): Promise<void> =>
  db.txn(async () => {
    const rows = dedupeLatestPerLane(batch);
    const plain = rows.filter((r) => r.dedupeKey === null);
    const keyed = rows.filter((r) => r.dedupeKey !== null);
    if (plain.length) await db.jobOutbox.createMany({ data: plain.map(toCreateInput), skipDuplicates: true });
    for (const row of keyed) {
      await db.jobOutbox.upsert({
        where: { handlerName_dedupeKey: { handlerName: row.handlerName, dedupeKey: row.dedupeKey as string } },
        create: toCreateInput(row),
        update: {
          jobId: row.jobId,
          data: row.data as Prisma.InputJsonValue,
          options: row.options as Prisma.InputJsonValue,
        },
      });
    }
  });

const flush = (): void => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!acc.length) return;
  const batch = acc; // synchronous swap — single-threaded JS, no await between
  acc = [];
  lastFlush = flushQueue.run(async () => {
    try {
      await writeBatch(batch);
      for (const p of batch) p.resolve();
    } catch (e) {
      for (const p of batch) p.reject(e); // callers awaiting spillToOutbox see the failure
      throw e; // surface to lastFlush
    }
  });
  lastFlush.catch(() => {}); // fire-and-forget (timer/size) path: callers already got the rejection
};

const accumulate = (row: OutboxRow): Promise<void> =>
  new Promise((resolve, reject) => {
    acc.push({ row, resolve, reject });
    if (closing) return; // shutdown drains via flushOutbox (with retry); its finally re-arms mid-drain stragglers
    if (acc.length >= flushMaxRows())
      flush(); // size trip — partitions a Promise.all burst inline
    else if (!timer) timer = setTimeout(flush, flushLinger()); // arm for the partial-batch tail
  });

// Spill one job. Everything routes through the accumulator; superseding lanes collapse at flush
// time. Resolves on COMMIT, never on accumulation — a crash in the flush window must not drop it.
export const spillToOutbox = (row: OutboxRow): Promise<void> => accumulate(row);

// Shutdown: persist every buffered row, retrying transient failures and surfacing the rest loudly.
// Call AFTER intake has stopped (server stopped / worker closed) so no new spills race the flush.
const flushBatchWithRetry = async (batch: Pending[]): Promise<void> => {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= SHUTDOWN_FLUSH_RETRIES; attempt++) {
    try {
      await flushQueue.run(() => writeBatch(batch));
      for (const p of batch) p.resolve();
      return;
    } catch (e) {
      lastErr = e;
      log.warn(`flushOutbox: flush failed (attempt ${attempt}/${SHUTDOWN_FLUSH_RETRIES})`, LogScope.job);
    }
  }
  for (const p of batch) p.reject(lastErr);
  log.error(`flushOutbox: gave up persisting ${batch.length} buffered job(s)`, lastErr, LogScope.job);
  throw lastErr;
};

export const flushOutbox = async (): Promise<void> => {
  closing = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  let persisted = 0;
  try {
    await lastFlush.catch(() => {}); // let any in-flight pre-shutdown flush settle first
    while (acc.length) {
      const batch = acc; // late spills during the await are caught by the next iteration
      acc = [];
      persisted += batch.length;
      await flushBatchWithRetry(batch);
    }
    if (persisted) log.info(`flushOutbox: persisted ${persisted} buffered job(s)`, LogScope.job);
  } finally {
    closing = false; // don't latch — an aborted shutdown (or a test) must be able to buffer again.
    // No timer re-arm here: during a real shutdown it could fire after Redis/DB are torn down. The
    // loop above already drained everything present; an aborted shutdown re-arms on its next spill.
  }
};
