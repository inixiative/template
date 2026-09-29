#!/usr/bin/env bun
import { createRedisConnection, db } from '@template/db';
import { resolveAll } from '@template/shared/utils';
import { type Job, PRIORITY_LIMIT, Queue, Worker } from 'bullmq';
import { z } from 'zod';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { flushOutbox, maxQueueDepth, maxSlowQueueDepth } from '#/jobs/outbox';
import { startOutboxDrainLoop, stopOutboxDrainLoop } from '#/jobs/outbox/drain';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { createSlowSlotPool } from '#/jobs/slowSlotPool';
import { JobLane } from '#/jobs/types';

const checkEnv = z
  .object({
    SLOW_LANE_CHECK_JOBS: z.coerce.number().int().positive().default(60),
    SLOW_LANE_CHECK_JOB_MS: z.coerce.number().int().nonnegative().default(3000),
    SLOW_LANE_CHECK_WORKERS: z.coerce.number().int().positive().default(2),
    SLOW_LANE_CHECK_FAST_WAIT_MS: z.coerce.number().int().positive().default(250),
  })
  .parse(process.env);

const SLOW_JOBS = checkEnv.SLOW_LANE_CHECK_JOBS;
const SLOW_JOB_MS = checkEnv.SLOW_LANE_CHECK_JOB_MS;
const WORKERS = checkEnv.SLOW_LANE_CHECK_WORKERS;
const FAST_WAIT_TARGET_MS = checkEnv.SLOW_LANE_CHECK_FAST_WAIT_MS;
const FAST_JOBS = 40;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Handlers = Record<string, (ctx: unknown, payload: never) => Promise<void>>;

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Number.NaN;
};

const waitUntil = async (condition: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) return false;
    await sleep(50);
  }
  return true;
};

const failuresOf = (checks: Array<string | false>): string[] =>
  checks.filter((failure): failure is string => typeof failure === 'string');

const assertDisposableTarget = (): void => {
  if (process.env.ENVIRONMENT !== 'local' || process.env.SLOW_LANE_CHECK_CONFIRM !== 'wipe') {
    throw new Error(
      'slowLaneCheck obliterates the jobs queue and empties JobOutbox — run it only with ENVIRONMENT=local and SLOW_LANE_CHECK_CONFIRM=wipe against a disposable Redis db and database',
    );
  }
};

const startWorker = (concurrency: number, handlers: (job: Job) => Handlers): Worker => {
  const slowSlots = createSlowSlotPool(concurrency);
  return new Worker('jobs', (job: Job) => processJob(job, { handlers: handlers(job) as never, slowSlots }), {
    connection: createRedisConnection('check:worker', resolveBullmqRedisUrl()),
    concurrency,
  });
};

const checkLaneCapacity = async () => {
  let slowRunning = 0;
  let peakSlowRunning = 0;
  const completions = new Map<number, number>();
  const fastWaits: number[] = [];

  const handlers: Handlers = {
    sendWebhook: async (_ctx, payload: { n: number }) => {
      slowRunning++;
      peakSlowRunning = Math.max(peakSlowRunning, slowRunning);
      await sleep(SLOW_JOB_MS);
      slowRunning--;
      completions.set(payload.n, (completions.get(payload.n) ?? 0) + 1);
    },
    cleanStaleData: async (_ctx, payload: { enqueuedAt: number }) => {
      fastWaits.push(Date.now() - payload.enqueuedAt);
    },
  };
  const concurrency = process.env.JOBS_WORKER_CONCURRENCY;
  const workers = Array.from({ length: WORKERS }, () => startWorker(concurrency, () => handlers));
  startOutboxDrainLoop();

  const slowSlots = WORKERS * createSlowSlotPool(concurrency).capacity;
  const startedAt = Date.now();
  const slowEnqueue = resolveAll(
    Array.from(
      { length: SLOW_JOBS },
      (_, n) => () => enqueueJob('sendWebhook', { n } as never, { lane: JobLane.slow }),
    ),
    100,
  );
  await waitUntil(() => slowRunning >= slowSlots, 30_000);
  const fastEvery = Math.max(20, Math.floor((SLOW_JOBS * SLOW_JOB_MS) / slowSlots / FAST_JOBS / 2));
  for (let i = 0; i < FAST_JOBS; i++) {
    await enqueueJob('cleanStaleData', { enqueuedAt: Date.now() } as never);
    await sleep(fastEvery);
  }
  const outboxedAtEnqueue = (await slowEnqueue).filter((r) => 'outboxed' in r && r.outboxed).length;
  await waitUntil(() => completions.size === SLOW_JOBS && fastWaits.length === FAST_JOBS, 600_000);
  const elapsedMs = Date.now() - startedAt;

  stopOutboxDrainLoop();
  await Promise.all(workers.map((worker) => worker.close()));

  const duplicates = [...completions.values()].filter((count) => count > 1).length;
  const lost = SLOW_JOBS - completions.size;
  const fastP95Ms = percentile(fastWaits, 0.95);
  return {
    report: {
      slots: WORKERS * concurrency,
      slowSlots,
      slowJobs: SLOW_JOBS,
      slowJobMs: SLOW_JOB_MS,
      depthBudget: maxQueueDepth(),
      slowDepthShare: maxSlowQueueDepth(),
      outboxedAtEnqueue,
      peakConcurrentSlow: peakSlowRunning,
      slowCompleted: completions.size,
      duplicates,
      lost,
      elapsedMs,
      idealMs: Math.ceil(SLOW_JOBS / slowSlots) * SLOW_JOB_MS,
      fastP50Ms: percentile(fastWaits, 0.5),
      fastP95Ms,
      fastMaxMs: Math.max(...fastWaits),
      fastWaitTargetMs: FAST_WAIT_TARGET_MS,
    },
    failures: failuresOf([
      peakSlowRunning > slowSlots && `slow work held ${peakSlowRunning} slots, over its ${slowSlots}`,
      peakSlowRunning < slowSlots && `slow work peaked at ${peakSlowRunning} of its ${slowSlots} slots`,
      fastWaits.length < FAST_JOBS && `${FAST_JOBS - fastWaits.length} fast jobs never started`,
      fastP95Ms >= FAST_WAIT_TARGET_MS && `fast p95 start ${fastP95Ms} ms, over the ${FAST_WAIT_TARGET_MS} ms target`,
      lost > 0 && `${lost} slow jobs lost`,
      duplicates > 0 && `${duplicates} slow jobs ran twice`,
    ]),
  };
};

const checkSlowPriorityOrder = async () => {
  const connection = createRedisConnection('check:priority', resolveBullmqRedisUrl());
  const probe = new Queue(`slow-lane-check-priority-${Bun.randomUUIDv7()}`, { connection });
  const scoresAt = async (priority: number) => {
    await probe.obliterate({ force: true });
    await probe.pause();
    await probe.addBulk(
      Array.from({ length: 200 }, (_, n) => ({ name: 'probe', data: {}, opts: { jobId: `j${n}`, priority } })),
    );
    const members = await connection.zrange(`${probe.qualifiedName}:prioritized`, 0, -1, 'WITHSCORES');
    const ids = members.filter((_, i) => i % 2 === 0);
    return {
      distinctScores: new Set(members.filter((_, i) => i % 2 === 1)).size,
      inAddOrder: ids.every((id, n) => id === `j${n}`),
    };
  };
  const slow = await scoresAt(SLOW_LANE_PRIORITY);
  const limit = await scoresAt(PRIORITY_LIMIT);
  await probe.obliterate({ force: true });
  await probe.close();
  await connection.quit();

  return {
    report: { slowLanePriority: slow, priorityLimit: limit },
    failures: failuresOf([
      slow.distinctScores < 200 && `SLOW_LANE_PRIORITY gave ${slow.distinctScores}/200 distinct scores`,
      !slow.inAddOrder && 'SLOW_LANE_PRIORITY jobs left add order',
    ]),
  };
};

const checkJumpedJobRepair = async () => {
  const failing = startWorker(1, () => ({
    sendWebhook: async () => {
      throw new Error('slowLaneCheck: first attempt fails');
    },
  }));
  const { jobId } = await enqueueJob('sendWebhook', { n: -1 } as never, { lane: JobLane.slow, attempts: 1 });
  const slowJob = await queue.getJob(jobId);
  if (!slowJob) throw new Error('slowLaneCheck: repair probe job vanished');
  await waitUntil(async () => (await slowJob.getState()) === 'failed', 30_000);
  await failing.close();

  await enqueueJob('cleanStaleData', { enqueuedAt: Date.now() } as never);
  await slowJob.retry();

  const ran: Array<{ name: string; priority: number }> = [];
  const recordRun = (job: Job) => async () => {
    ran.push({ name: job.name, priority: job.priority });
  };
  const recorder = startWorker(1, (job) => ({ sendWebhook: recordRun(job), cleanStaleData: recordRun(job) }));
  await waitUntil(() => ran.length === 2, 30_000);
  await recorder.close();

  return {
    report: { runOrder: ran },
    failures: failuresOf([
      ran[0]?.name !== 'cleanStaleData' && `a retried slow job ran before waiting fast work: ${JSON.stringify(ran)}`,
      ran.find((entry) => entry.name === 'sendWebhook')?.priority !== SLOW_LANE_PRIORITY &&
        'the retried slow job lost its priority',
    ]),
  };
};

const main = async () => {
  assertDisposableTarget();
  await queue.obliterate({ force: true });
  await queue.redis.flushdb();
  await db.jobOutbox.deleteMany({});

  const laneCapacity = await checkLaneCapacity();
  const slowPriorityOrder = await checkSlowPriorityOrder();
  const jumpedJobRepair = await checkJumpedJobRepair();
  const failures = [...laneCapacity.failures, ...slowPriorityOrder.failures, ...jumpedJobRepair.failures];

  console.log(
    JSON.stringify(
      {
        laneCapacity: laneCapacity.report,
        slowPriorityOrder: slowPriorityOrder.report,
        jumpedJobRepair: jumpedJobRepair.report,
        outboxLeft: await db.jobOutbox.count(),
        failures,
      },
      null,
      2,
    ),
  );

  await flushOutbox();
  await queue.obliterate({ force: true });
  await queue.close();
  await db.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
};

await main();
