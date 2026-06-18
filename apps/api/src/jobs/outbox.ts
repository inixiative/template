/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { db, type Prisma, redisNamespace } from '@template/db';
import { createSerializedQueue } from '@template/shared/utils';
import { queue } from '#/jobs/queue';
import type { JobData, JobOptions } from '#/jobs/types';

// Durable overflow buffer in front of BullMQ. When queue depth crosses a cap an
// "overflow" flag flips and adhoc enqueues spill to the JobOutbox table instead of
// Redis; the drain cron meters them back in. See docs/design/jobs-overflow-buffer.md.

export const MAX_QUEUE_DEPTH = Number(process.env.JOBS_MAX_QUEUE_DEPTH ?? 10_000);
export const LOW_WATER = Math.floor(MAX_QUEUE_DEPTH * 0.8);
const FLUSH_MAX_ROWS = Number(process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS ?? 1000);
const FLUSH_LINGER_MS = Number(process.env.JOBS_OUTBOX_FLUSH_LINGER_MS ?? 200);
const DEPTH_CACHE_MS = 1000;

const FLAG_KEY = `${redisNamespace.job}:overflow`;

export type OutboxRow = {
  handlerName: string;
  jobId: string;
  dedupeKey: string | null;
  data: JobData;
  options: JobOptions;
};

// JobData/JobOptions are typed objects; Prisma's Json columns want InputJsonValue.
const toCreateInput = (row: OutboxRow): Prisma.JobOutboxCreateManyInput => ({
  handlerName: row.handlerName,
  jobId: row.jobId,
  dedupeKey: row.dedupeKey,
  data: row.data as Prisma.InputJsonValue,
  options: row.options as Prisma.InputJsonValue,
});

// --- depth probe: fleet-global (Redis), cached so it runs ~once/sec regardless of enqueue rate ---
let cachedDepth = 0;
let cachedAt = 0;

export const queueDepth = async (fresh = false): Promise<number> => {
  const now = Date.now();
  if (!fresh && now - cachedAt < DEPTH_CACHE_MS) return cachedDepth;
  const counts = await queue.getJobCounts('waiting', 'delayed');
  cachedDepth = (counts.waiting ?? 0) + (counts.delayed ?? 0);
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
  if ((await queueDepth()) >= MAX_QUEUE_DEPTH) await setOverflow();
};

// --- fan-out accumulator: coalesce plain adhoc spills into bulk createMany ---
type Pending = { row: OutboxRow; resolve: () => void; reject: (e: unknown) => void };

let acc: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const flushQueue = createSerializedQueue(); // serialize the writes — one createMany at a time, no pool storm

const flush = (): void => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!acc.length) return;
  const batch = acc; // synchronous swap — single-threaded JS, no await between
  acc = [];
  void flushQueue.run(async () => {
    try {
      await db.jobOutbox.createMany({ data: batch.map((p) => toCreateInput(p.row)), skipDuplicates: true });
      for (const p of batch) p.resolve();
    } catch (e) {
      for (const p of batch) p.reject(e);
    }
  });
};

const accumulate = (row: OutboxRow): Promise<void> =>
  new Promise((resolve, reject) => {
    acc.push({ row, resolve, reject });
    if (acc.length >= FLUSH_MAX_ROWS) flush(); // size trip — partitions a Promise.all burst inline
    else if (!timer) timer = setTimeout(flush, FLUSH_LINGER_MS); // arm for the partial-batch tail
  });

// Spill one job. Resolves on the createMany/insert COMMIT, never on accumulation —
// otherwise a crash in the flush window silently drops the job.
export const spillToOutbox = (row: OutboxRow): Promise<void> => {
  if (row.dedupeKey) {
    // Superseding: latest wins. Delete the buffered lane, then insert — low-volume, so inline (not batched).
    return db.txn(async () => {
      await db.jobOutbox.deleteMany({ where: { handlerName: row.handlerName, dedupeKey: row.dedupeKey } });
      await db.jobOutbox.create({ data: toCreateInput(row) });
    });
  }
  return accumulate(row); // plain adhoc fan-out → batched createMany
};

// Drain any buffered rows + settle in-flight flushes. Call on worker shutdown.
export const flushOutbox = async (): Promise<void> => {
  flush();
  await flushQueue.run(async () => {});
};
