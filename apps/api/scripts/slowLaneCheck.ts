#!/usr/bin/env bun
import { createRedisConnection, db } from '@template/db';
import { resolveAll } from '@template/shared/utils';
import { type Job, Worker } from 'bullmq';
import { z } from 'zod';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { flushOutbox } from '#/jobs/outbox';
import { startOutboxDrainLoop, stopOutboxDrainLoop } from '#/jobs/outbox/drain';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { bulkCapacity } from '#/jobs/slowLane/capacity';
import { startWorkerPresence, stopWorkerPresence } from '#/jobs/slowLane/presence';
import { JobLane } from '#/jobs/types';

const checkEnv = z
  .object({
    SLOW_LANE_CHECK_JOBS: z.coerce.number().int().positive().default(400),
    SLOW_LANE_CHECK_JOB_MS: z.coerce.number().int().nonnegative().default(60),
    SLOW_LANE_CHECK_WITH_DRAIN: z.enum(['0', '1']).default('0'),
  })
  .parse(process.env);

const SLOW_JOBS = checkEnv.SLOW_LANE_CHECK_JOBS;
const FAST_JOBS = 20;
const SLOW_JOB_MS = checkEnv.SLOW_LANE_CHECK_JOB_MS;
const WITH_DRAIN = checkEnv.SLOW_LANE_CHECK_WITH_DRAIN === '1';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let running = 0;
let maxRunning = 0;
const completions = new Map<number, number>();
const fastWaits: number[] = [];

const slowHandler = async (_ctx: unknown, payload: { n: number }) => {
  running++;
  maxRunning = Math.max(maxRunning, running);
  await sleep(SLOW_JOB_MS);
  completions.set(payload.n, (completions.get(payload.n) ?? 0) + 1);
  running--;
};

const fastHandler = async (_ctx: unknown, payload: { enqueuedAt: number }) => {
  fastWaits.push(Date.now() - payload.enqueuedAt);
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? NaN;
};

const assertDisposableTarget = (): void => {
  if (process.env.ENVIRONMENT !== 'local' || process.env.SLOW_LANE_CHECK_CONFIRM !== 'wipe') {
    throw new Error(
      'slowLaneCheck obliterates the jobs queue and empties JobOutbox — run it only with ENVIRONMENT=local and SLOW_LANE_CHECK_CONFIRM=wipe against a disposable Redis db and database',
    );
  }
};

const main = async () => {
  assertDisposableTarget();
  await queue.obliterate({ force: true });
  await queue.redis.flushdb();
  await db.jobOutbox.deleteMany({});

  await startWorkerPresence();
  const handlers = { sendWebhook: slowHandler as never, cleanStaleData: fastHandler as never };
  const workers = [0, 1].map(
    () =>
      new Worker('jobs', (job: Job) => processJob(job, { handlers }), {
        connection: createRedisConnection('check:worker', resolveBullmqRedisUrl()),
        concurrency: process.env.JOBS_WORKER_CONCURRENCY,
      }),
  );
  if (WITH_DRAIN) startOutboxDrainLoop();

  const startedAt = Date.now();
  const slowEnqueue = resolveAll(
    Array.from(
      { length: SLOW_JOBS },
      (_, n) => () => enqueueJob('sendWebhook', { n } as never, { lane: JobLane.slow }),
    ),
    100,
  );
  await sleep(1_000);
  for (let i = 0; i < FAST_JOBS; i++) await enqueueJob('cleanStaleData', { enqueuedAt: Date.now() } as never);
  const enqueueResults = await slowEnqueue;
  const enqueueMs = Date.now() - startedAt;
  const outboxedAtEnqueue = enqueueResults.filter((r) => 'outboxed' in r && r.outboxed).length;

  const deadline = Date.now() + 180_000;
  while ((completions.size < SLOW_JOBS || fastWaits.length < FAST_JOBS) && Date.now() < deadline) await sleep(100);
  const elapsedMs = Date.now() - startedAt;
  await sleep(500);

  const duplicates = [...completions.values()].filter((count) => count > 1).length;
  const capacity = await bulkCapacity(queue.redis);
  const report = {
    mode: WITH_DRAIN ? 'self-feed + drain' : 'self-feed only (drain off)',
    cap: capacity.cap,
    slowJobs: SLOW_JOBS,
    slowJobMs: SLOW_JOB_MS,
    maxConcurrentSlow: maxRunning,
    slowCompleted: completions.size,
    duplicates,
    lost: SLOW_JOBS - completions.size,
    outboxedAtEnqueue,
    enqueueMs,
    elapsedMs,
    idealMs: Math.ceil(SLOW_JOBS / capacity.cap) * SLOW_JOB_MS,
    fastP50Ms: percentile(fastWaits, 50),
    fastMaxMs: Math.max(...fastWaits),
    outboxLeft: await db.jobOutbox.count(),
    slotsOccupied: capacity.occupied,
    queueCounts: await queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
  };
  console.log(JSON.stringify(report, null, 2));

  stopOutboxDrainLoop();
  await Promise.all(workers.map((worker) => worker.close()));
  await stopWorkerPresence();
  await flushOutbox();
  await queue.obliterate({ force: true });
  await queue.close();
  await db.$disconnect();
  process.exit(report.lost === 0 && duplicates === 0 && maxRunning <= capacity.cap ? 0 : 1);
};

await main();
