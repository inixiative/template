/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { flushLinger, flushMaxRows, SHUTDOWN_FLUSH_RETRIES } from '#/jobs/outbox/config';
import { flushQueue } from '#/jobs/outbox/mutex';
import { type OutboxRow, toCreateInput } from '#/jobs/outbox/types';

// --- accumulator: ALL spills (fan-out AND superseding) coalesce into one batched write ---
type Pending = { row: OutboxRow; resolve: () => void; reject: (e: unknown) => void };

let acc: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let closing = false; // shutdown: stop arming timers — flushOutbox owns the final drain
let lastFlush: Promise<void> = Promise.resolve();

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

// Insert the batch in one txn: plain fan-out rows via createManyAndReturn (jobId-idempotent),
// superseding lanes via upsert. Upsert is last-writer-wins with no silent drop even when two processes
// flush the same lane — skipDuplicates would keep whichever COMMITS first, not the latest.
const writeBatch = (batch: Pending[]): Promise<void> =>
  db.txn(async () => {
    const rows = dedupeLatestPerLane(batch);
    const plain = rows.filter((r) => r.dedupeKey === null);
    const keyed = rows.filter((r) => r.dedupeKey !== null);
    if (plain.length) await db.jobOutbox.createManyAndReturn({ data: plain.map(toCreateInput), skipDuplicates: true });
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
