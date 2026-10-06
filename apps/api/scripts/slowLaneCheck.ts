#!/usr/bin/env bun
import { createRedisConnection, db } from '@template/db';
import { resolveAll } from '@template/shared/utils';
import { type Job, PRIORITY_LIMIT, Queue, QueueEvents, Worker } from 'bullmq';
import { z } from 'zod';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import {
  flushOutbox,
  maxQueueDepth,
  maxSlowQueueDepth,
  queueDepths,
  spillToOutbox,
} from '#/jobs/outbox';
import { startOutboxDrainLoop, stopOutboxDrainLoop } from '#/jobs/outbox/drain';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { readSlowLaneState } from '#/jobs/readSlowLaneState';
import { SLOW_PARK_MIN_MS } from '#/jobs/slowLaneSignals';
import { createSlowSlotPool } from '#/jobs/slowSlotPool';
import { JobLane, JobType } from '#/jobs/types';

const checkEnv = z
  .object({
    SLOW_LANE_CHECK_JOBS: z.coerce.number().int().positive().default(60),
    SLOW_LANE_CHECK_JOB_MS: z.coerce.number().int().nonnegative().default(3000),
    SLOW_LANE_CHECK_WORKERS: z.coerce.number().int().positive().default(2),
    SLOW_LANE_CHECK_FAST_WAIT_MS: z.coerce.number().int().positive().default(250),
    SLOW_LANE_CHECK_SEND_JOBS: z.coerce.number().int().positive().default(200),
    SLOW_LANE_CHECK_SEND_JOB_MS: z.coerce.number().int().positive().default(5000),
  })
  .parse(process.env);

const SLOW_JOBS = checkEnv.SLOW_LANE_CHECK_JOBS;
const SLOW_JOB_MS = checkEnv.SLOW_LANE_CHECK_JOB_MS;
const WORKERS = checkEnv.SLOW_LANE_CHECK_WORKERS;
const FAST_WAIT_TARGET_MS = checkEnv.SLOW_LANE_CHECK_FAST_WAIT_MS;
const FAST_JOBS = 40;
const SEND_JOBS = checkEnv.SLOW_LANE_CHECK_SEND_JOBS;
const SEND_JOB_MS = checkEnv.SLOW_LANE_CHECK_SEND_JOB_MS;
const SEND_SAMPLE_MS = 250;
const SEND_SHARE_OVERSHOOT = 0.1;
const SEND_UTILIZATION_FLOOR = 0.8;
const SIGNAL_MIN_TRUTH = 20;
const SIGNAL_MIN_RATIO = 0.8;
const SIGNAL_MAX_RATIO = 1.25;
const HUNG_JOBS = 5;
const HUNG_FOR_MS = 3000;
const TEARDOWN_DEADLINE_MS = 30_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Handlers = Record<string, (ctx: unknown, payload: never) => Promise<void>>;

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Number.NaN;
};

const waitUntil = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) return false;
    await sleep(50);
  }
  return true;
};

const failuresOf = (checks: Array<string | false>): string[] =>
  checks.filter((failure): failure is string => typeof failure === 'string');

const withDeadline = async <T>(label: string, work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not finish within ${TEARDOWN_DEADLINE_MS} ms`)),
      TEARDOWN_DEADLINE_MS,
    );
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};

const slowJobsInRedis = async (): Promise<number> => {
  const counts = await queue.getJobCounts('prioritized', 'delayed');
  return (counts.prioritized ?? 0) + (counts.delayed ?? 0);
};

const queueEmpty = async (): Promise<boolean> => {
  const counts = await queue.getJobCounts('waiting', 'prioritized', 'active', 'delayed');
  return Object.values(counts).every((count) => count === 0);
};

const assertDisposableTarget = (): void => {
  if (process.env.ENVIRONMENT !== 'local' || process.env.SLOW_LANE_CHECK_CONFIRM !== 'wipe') {
    throw new Error(
      'slowLaneCheck obliterates the jobs queue and empties JobOutbox — run it only with ENVIRONMENT=local and SLOW_LANE_CHECK_CONFIRM=wipe against a disposable Redis db and database',
    );
  }
};

const startWorker = (concurrency: number, handlers: (job: Job) => Handlers): Worker => {
  const slowSlots = createSlowSlotPool(concurrency);
  return new Worker(
    'jobs',
    (job: Job) => processJob(job, { handlers: handlers(job) as never, slowSlots }),
    {
      connection: createRedisConnection('check:worker', resolveBullmqRedisUrl()),
      concurrency,
    },
  );
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
      peakSlowRunning > slowSlots &&
        `slow work held ${peakSlowRunning} slots, over its ${slowSlots}`,
      peakSlowRunning < slowSlots &&
        `slow work peaked at ${peakSlowRunning} of its ${slowSlots} slots`,
      fastWaits.length < FAST_JOBS && `${FAST_JOBS - fastWaits.length} fast jobs never started`,
      fastP95Ms >= FAST_WAIT_TARGET_MS &&
        `fast p95 start ${fastP95Ms} ms, over the ${FAST_WAIT_TARGET_MS} ms target`,
      lost > 0 && `${lost} slow jobs lost`,
      duplicates > 0 && `${duplicates} slow jobs ran twice`,
    ]),
  };
};

const checkSendLargerThanShare = async () => {
  const completions = new Map<number, number>();
  const handlers: Handlers = {
    sendWebhook: async (_ctx, payload: { n: number }) => {
      await sleep(SEND_JOB_MS);
      completions.set(payload.n, (completions.get(payload.n) ?? 0) + 1);
    },
  };
  const concurrency = process.env.JOBS_WORKER_CONCURRENCY;
  const workers = Array.from({ length: WORKERS }, () => startWorker(concurrency, () => handlers));
  const failedJobs: string[] = [];
  for (const worker of workers)
    worker.on('failed', (job, err) => failedJobs.push(`${job?.id}: ${err.message}`));
  const events = new QueueEvents('jobs', {
    connection: createRedisConnection('check:events', resolveBullmqRedisUrl()),
  });
  let parks = 0;
  events.on('delayed', () => {
    parks++;
  });
  await Promise.all([events.waitUntilReady(), ...workers.map((worker) => worker.waitUntilReady())]);

  const slowSlots = WORKERS * createSlowSlotPool(concurrency).capacity;
  const share = maxSlowQueueDepth();
  const startedAt = Date.now();
  await Promise.all(
    Array.from({ length: SEND_JOBS }, (_, n) =>
      spillToOutbox({
        handlerName: 'sendWebhook',
        jobId: `send-${n}`,
        dedupeKey: null,
        data: { type: JobType.adhoc, lane: JobLane.slow, payload: { n } },
        options: { removeOnComplete: true, removeOnFail: true },
      }),
    ),
  );
  startOutboxDrainLoop();

  const loops = { isRunning: true };
  const signal = {
    peakInRedis: 0,
    lowestRatio: Number.POSITIVE_INFINITY,
    highestRatio: 0,
    truthTotal: 0,
    samples: 0,
  };
  const sampleLoop = (async () => {
    while (loops.isRunning) {
      const [truth, depths] = await Promise.all([slowJobsInRedis(), queueDepths(true)]);
      signal.peakInRedis = Math.max(signal.peakInRedis, truth);
      signal.truthTotal += truth;
      signal.samples++;
      if (truth >= SIGNAL_MIN_TRUTH) {
        signal.lowestRatio = Math.min(signal.lowestRatio, depths.slow / truth);
        signal.highestRatio = Math.max(signal.highestRatio, depths.slow / truth);
      }
      await sleep(SEND_SAMPLE_MS);
    }
  })();

  await waitUntil(
    async () =>
      failedJobs.length > 0 ||
      (completions.size === SEND_JOBS &&
        (await db.jobOutbox.count()) === 0 &&
        (await queueEmpty())),
    600_000,
  );
  const sendSeconds = (Date.now() - startedAt) / 1000;
  loops.isRunning = false;
  await withDeadline('send: sample loop', sampleLoop);
  stopOutboxDrainLoop();
  await withDeadline('send: worker close', Promise.all(workers.map((worker) => worker.close())));
  await withDeadline('send: queue events close', events.close());

  const averageQueuedSlow = signal.samples ? signal.truthTotal / signal.samples : 0;
  const parksPerQueuedJobSecond = averageQueuedSlow ? parks / sendSeconds / averageQueuedSlow : 0;
  const parkRateCeiling = (1000 / SLOW_PARK_MIN_MS) * 1.1;
  const shareCeiling = Math.ceil(share * (1 + SEND_SHARE_OVERSHOOT));
  const idealSeconds = (SEND_JOBS * SEND_JOB_MS) / 1000 / slowSlots;
  const slotUtilization = idealSeconds / sendSeconds;
  const duplicates = [...completions.values()].filter((count) => count > 1).length;
  const lost = SEND_JOBS - completions.size;
  const lowestRatio = Number.isFinite(signal.lowestRatio) ? signal.lowestRatio : Number.NaN;

  return {
    report: {
      sendJobs: SEND_JOBS,
      sendJobMs: SEND_JOB_MS,
      slowDepthShare: share,
      slowSlots,
      sendSeconds,
      peakSlowJobsInRedis: signal.peakInRedis,
      shareCeiling,
      slowSignalToTruth: { lowest: lowestRatio, highest: signal.highestRatio },
      parks,
      parksPerQueuedJobSecond,
      parkRateCeiling,
      slotUtilization,
      duplicates,
      lost,
    },
    failures: failuresOf([
      SEND_JOBS <= share && `the send of ${SEND_JOBS} does not exceed the slow share of ${share}`,
      signal.peakInRedis > shareCeiling &&
        `the drain let ${signal.peakInRedis} slow jobs into Redis, over the ${shareCeiling} ceiling`,
      lowestRatio < SIGNAL_MIN_RATIO &&
        `the slow signal read ${lowestRatio.toFixed(2)} of the slow jobs queued`,
      signal.highestRatio > SIGNAL_MAX_RATIO &&
        `the slow signal read ${signal.highestRatio.toFixed(2)} times the slow jobs queued`,
      parksPerQueuedJobSecond > parkRateCeiling &&
        `queued slow jobs were parked ${parksPerQueuedJobSecond.toFixed(2)} times a second each, over ${parkRateCeiling.toFixed(2)}`,
      slotUtilization < SEND_UTILIZATION_FLOOR &&
        `slow slots were ${(slotUtilization * 100).toFixed(0)}% busy during the send, under ${SEND_UTILIZATION_FLOOR * 100}%`,
      failedJobs.length > 0 && `worker failures: ${failedJobs.join('; ')}`,
      lost > 0 && `${lost} send payloads never completed`,
      duplicates > 0 && `${duplicates} send payloads ran twice`,
    ]),
  };
};

const checkHungSlowHandlers = async () => {
  const idleBefore = (await readSlowLaneState()).idleMs;
  let releaseHung: () => void = () => {};
  const hungGate = new Promise<void>((resolve) => {
    releaseHung = resolve;
  });
  const hung = { running: 0, completed: 0 };
  const worker = startWorker(2, () => ({
    sendWebhook: async () => {
      hung.running++;
      await hungGate;
      hung.completed++;
    },
  }));
  await worker.waitUntilReady();
  for (let n = 0; n < HUNG_JOBS; n++)
    await enqueueJob('sendWebhook', { n } as never, { lane: JobLane.slow });

  await waitUntil(() => hung.running >= 1, 30_000);
  await readSlowLaneState();
  await sleep(HUNG_FOR_MS);
  const whileHung = await readSlowLaneState();
  releaseHung();
  await waitUntil(async () => hung.completed === HUNG_JOBS && (await queueEmpty()), 120_000);
  await withDeadline('hung: worker close', worker.close());
  const afterDrained = await readSlowLaneState();

  return {
    report: {
      idleBeforeMs: idleBefore,
      whileHung: {
        queued: whileHung.queued,
        deferred: whileHung.deferred,
        idleMs: whileHung.idleMs,
      },
      afterDrainedIdleMs: afterDrained.idleMs,
    },
    failures: failuresOf([
      idleBefore !== 0 && `the idle signal read ${idleBefore} ms with no slow work queued`,
      whileHung.queued === 0 && 'hung slow work read as nothing queued',
      whileHung.queued > HUNG_JOBS &&
        `${HUNG_JOBS} hung slow jobs read as ${whileHung.queued} queued`,
      whileHung.idleMs < HUNG_FOR_MS * 0.8 &&
        `the idle signal read ${whileHung.idleMs} ms after ${HUNG_FOR_MS} ms of hung slow handlers`,
      afterDrained.idleMs !== 0 && 'the idle signal stayed up after the slow lane emptied',
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
      Array.from({ length: 200 }, (_, n) => ({
        name: 'probe',
        data: {},
        opts: { jobId: `j${n}`, priority },
      })),
    );
    const members = await connection.zrange(
      `${probe.qualifiedName}:prioritized`,
      0,
      -1,
      'WITHSCORES',
    );
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
      slow.distinctScores < 200 &&
        `SLOW_LANE_PRIORITY gave ${slow.distinctScores}/200 distinct scores`,
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
  const { jobId } = await enqueueJob('sendWebhook', { n: -1 } as never, {
    lane: JobLane.slow,
    attempts: 1,
  });
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
  const recorder = startWorker(1, (job) => ({
    sendWebhook: recordRun(job),
    cleanStaleData: recordRun(job),
  }));
  await waitUntil(() => ran.length === 2, 30_000);
  await recorder.close();

  return {
    report: { runOrder: ran },
    failures: failuresOf([
      ran[0]?.name !== 'cleanStaleData' &&
        `a retried slow job ran before waiting fast work: ${JSON.stringify(ran)}`,
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
  const sendLargerThanShare = await checkSendLargerThanShare();
  const hungSlowHandlers = await checkHungSlowHandlers();
  const slowPriorityOrder = await checkSlowPriorityOrder();
  const jumpedJobRepair = await checkJumpedJobRepair();
  const failures = [
    ...laneCapacity.failures,
    ...sendLargerThanShare.failures,
    ...hungSlowHandlers.failures,
    ...slowPriorityOrder.failures,
    ...jumpedJobRepair.failures,
  ];

  console.log(
    JSON.stringify(
      {
        laneCapacity: laneCapacity.report,
        sendLargerThanShare: sendLargerThanShare.report,
        hungSlowHandlers: hungSlowHandlers.report,
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
