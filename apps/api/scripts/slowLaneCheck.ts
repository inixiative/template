#!/usr/bin/env bun
import { createRedisConnection, db } from '@template/db';
import { resolveAll } from '@template/shared/utils';
import { type Job, Worker } from 'bullmq';
import { z } from 'zod';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { flushOutbox, maxQueueDepth, maxSlowQueueDepth } from '#/jobs/outbox';
import { startOutboxDrainLoop, stopOutboxDrainLoop } from '#/jobs/outbox/drain';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { JobLane } from '#/jobs/types';

const checkEnv = z
  .object({
    SLOW_LANE_CHECK_JOBS: z.coerce.number().int().positive().default(2000),
    SLOW_LANE_CHECK_JOB_MS: z.coerce.number().int().nonnegative().default(60),
    SLOW_LANE_CHECK_WORKERS: z.coerce.number().int().positive().default(2),
  })
  .parse(process.env);

const SLOW_JOBS = checkEnv.SLOW_LANE_CHECK_JOBS;
const SLOW_JOB_MS = checkEnv.SLOW_LANE_CHECK_JOB_MS;
const WORKERS = checkEnv.SLOW_LANE_CHECK_WORKERS;
const FAST_JOBS = 40;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let running = 0;
let peakSlow = 0;
let peakSlowInQueue = 0;
const completions = new Map<number, number>();
const fastWaits: number[] = [];

const slowHandler = async (_ctx: unknown, payload: { n: number }) => {
  running++;
  peakSlow = Math.max(peakSlow, running);
  await sleep(SLOW_JOB_MS);
  completions.set(payload.n, (completions.get(payload.n) ?? 0) + 1);
  running--;
};

const fastHandler = async (_ctx: unknown, payload: { enqueuedAt: number }) => {
  fastWaits.push(Date.now() - payload.enqueuedAt);
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Number.NaN;
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

  const handlers = { sendWebhook: slowHandler as never, cleanStaleData: fastHandler as never };
  const workers = Array.from(
    { length: WORKERS },
    () =>
      new Worker('jobs', (job: Job) => processJob(job, { handlers }), {
        connection: createRedisConnection('check:worker', resolveBullmqRedisUrl()),
        concurrency: process.env.JOBS_WORKER_CONCURRENCY,
      }),
  );
  startOutboxDrainLoop();
  const sampler = setInterval(async () => {
    const { prioritized = 0 } = await queue.getJobCounts('prioritized');
    peakSlowInQueue = Math.max(peakSlowInQueue, prioritized);
  }, 100);

  const slots = WORKERS * process.env.JOBS_WORKER_CONCURRENCY;
  const startedAt = Date.now();
  const slowEnqueue = resolveAll(
    Array.from(
      { length: SLOW_JOBS },
      (_, n) => () => enqueueJob('sendWebhook', { n } as never, { lane: JobLane.slow }),
    ),
    100,
  );
  const fastEvery = Math.max(20, (SLOW_JOBS * SLOW_JOB_MS) / slots / FAST_JOBS / 2);
  for (let i = 0; i < FAST_JOBS; i++) {
    await sleep(fastEvery);
    await enqueueJob('cleanStaleData', { enqueuedAt: Date.now() } as never);
  }
  const outboxedAtEnqueue = (await slowEnqueue).filter((r) => 'outboxed' in r && r.outboxed).length;

  const deadline = Date.now() + 300_000;
  while ((completions.size < SLOW_JOBS || fastWaits.length < FAST_JOBS) && Date.now() < deadline) await sleep(100);
  const elapsedMs = Date.now() - startedAt;
  clearInterval(sampler);
  await sleep(500);

  const duplicates = [...completions.values()].filter((count) => count > 1).length;
  const report = {
    slots,
    slowJobs: SLOW_JOBS,
    slowJobMs: SLOW_JOB_MS,
    depthBudget: maxQueueDepth(),
    slowDepthShare: maxSlowQueueDepth(),
    peakSlowInQueue,
    outboxedAtEnqueue,
    peakConcurrentSlow: peakSlow,
    slowCompleted: completions.size,
    duplicates,
    lost: SLOW_JOBS - completions.size,
    elapsedMs,
    idealMs: Math.ceil(SLOW_JOBS / slots) * SLOW_JOB_MS,
    fastP50Ms: percentile(fastWaits, 0.5),
    fastP95Ms: percentile(fastWaits, 0.95),
    fastMaxMs: Math.max(...fastWaits),
    outboxLeft: await db.jobOutbox.count(),
    queueCounts: await queue.getJobCounts('waiting', 'prioritized', 'active', 'delayed', 'failed'),
  };
  console.log(JSON.stringify(report, null, 2));

  stopOutboxDrainLoop();
  await Promise.all(workers.map((worker) => worker.close()));
  await flushOutbox();
  await queue.obliterate({ force: true });
  await queue.close();
  await db.$disconnect();
  process.exit(report.lost === 0 && duplicates === 0 ? 0 : 1);
};

await main();
