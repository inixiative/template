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
const DEPTH_CACHE_MS = 1000;

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

// --- the overflow flag (global) ---
export const isOverflowing = async (): Promise<boolean> => (await queue.redis.get(FLAG_KEY)) === '1';
const setOverflow = (): Promise<unknown> => queue.redis.set(FLAG_KEY, '1');
export const clearOverflow = (): Promise<unknown> => queue.redis.del(FLAG_KEY);

// Trip the flag inline when a direct add crosses the cap — a fan-out fills the queue
// long before the next drain tick, so the producer side must set it; the drain clears it.
export const tripIfFull = async (): Promise<void> => {
  if ((await queueDepth()) >= maxQueueDepth()) await setOverflow();
};

// Abort any queued/in-flight job sharing this supersede lane. Both the direct enqueue path
// and the drain call this, so supersession is enforced wherever a superseding job enters.
export const signalSupersededJobs = async (dedupeKey: string): Promise<void> => {
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'paused']);
  for (const job of jobs) {
    if (!job.id) continue;
    if ((job.data as JobData).dedupeKey === dedupeKey) {
      await queue.redis.set(`${redisNamespace.job}:superseded:${job.id}`, '1', 'EX', 300);
      log.info(`Signaled job ${job.id} to abort (superseded)`, LogScope.job);
    }
  }
};

// --- fan-out accumulator: coalesce plain adhoc spills into bulk createMany ---
type Pending = { row: OutboxRow; resolve: () => void; reject: (e: unknown) => void };

let acc: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let closing = false; // shutdown: flush inline instead of waiting on the timer
let lastFlush: Promise<void> = Promise.resolve();
const flushQueue = createSerializedQueue(); // serialize the writes — one createMany at a time

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
      await db.jobOutbox.createMany({ data: batch.map((p) => toCreateInput(p.row)), skipDuplicates: true });
      for (const p of batch) p.resolve();
    } catch (e) {
      for (const p of batch) p.reject(e); // callers awaiting spillToOutbox see the failure
      throw e; // surface to lastFlush so flushOutbox (shutdown) can observe it
    }
  });
  lastFlush.catch(() => {}); // fire-and-forget (timer/size) path: callers already got the rejection
};

const accumulate = (row: OutboxRow): Promise<void> =>
  new Promise((resolve, reject) => {
    acc.push({ row, resolve, reject });
    if (closing || acc.length >= flushMaxRows()) flush(); // size trip / shutdown — flush now
    else if (!timer) timer = setTimeout(flush, flushLinger()); // arm for the partial-batch tail
  });

// Spill one job. Resolves on the createMany/upsert COMMIT, never on accumulation —
// otherwise a crash in the flush window silently drops the job.
export const spillToOutbox = (row: OutboxRow): Promise<void> => {
  if (row.dedupeKey) {
    // Superseding: latest wins. Atomic upsert on the (handlerName, dedupeKey) lane —
    // race-safe (no read-then-write), unlike a deleteMany+create pair.
    return db.jobOutbox
      .upsert({
        where: { handlerName_dedupeKey: { handlerName: row.handlerName, dedupeKey: row.dedupeKey } },
        create: toCreateInput(row),
        update: {
          jobId: row.jobId,
          data: row.data as Prisma.InputJsonValue,
          options: row.options as Prisma.InputJsonValue,
        },
      })
      .then(() => undefined);
  }
  return accumulate(row); // plain adhoc fan-out → batched createMany
};

// Persist any buffered rows and observe in-flight flushes. Call on shutdown AFTER intake
// has stopped (server stopped / worker closed), so no new spills race the final flush.
export const flushOutbox = async (): Promise<void> => {
  closing = true;
  const pending = acc.length;
  flush();
  try {
    await lastFlush; // the flush we just queued (or the most recent in-flight one)
    await flushQueue.run(async () => {}); // and anything else still queued behind it
    if (pending) log.info(`flushOutbox: persisted ${pending} buffered job(s)`, LogScope.job);
  } catch (e) {
    log.error(`flushOutbox: failed to persist ${pending} buffered job(s)`, e, LogScope.job);
    throw e;
  }
};
