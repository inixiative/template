#!/usr/bin/env bun
// The test suite's Redis is an in-memory mock that cannot run BullMQ's Lua scripts, so nothing in it
// can prove that flows, deduplication or parent tombstones work. This check runs them for real: real
// Redis, a real BullMQ worker running processJob, real enqueueJob, against handlers it registers for
// the run. It fails (exit 1) unless:
//
// - a staged job parks in `waiting-children` while its leaves run, runs its stage once, and runs
//   `finish` once, after the last leaf;
// - a child that fails every attempt is retried, then lets its parent finish;
// - a staged singleton skips a second enqueue while it is parked, and its key frees once it finishes;
// - superseding a staged job aborts its running children within two seconds, the replaced parent never
//   runs `finish`, and the aborted children never write;
// - a cron tick enqueues the real run, and a second tick while that run is going is skipped;
// - no job fails unexpectedly.
//
// It obliterates the jobs queue before and after, so it refuses to run without ENVIRONMENT=local and
// JOB_FLOW_CHECK_CONFIRM=wipe. Point REDIS_URL and REDIS_BULLMQ_URL at a disposable Redis db:
//
//   bun run with local api env JOB_FLOW_CHECK_CONFIRM=wipe \
//     REDIS_URL=redis://localhost:6379/12 REDIS_BULLMQ_URL=redis://localhost:6379/12 \
//     bun apps/api/scripts/jobFlowCheck.ts
import { createRedisConnection } from '@template/db';
import { type Job, Worker } from 'bullmq';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { jobHandlers } from '#/jobs/handlers';
import { makeJob } from '#/jobs/makeJob';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { createSlowSlotPool } from '#/jobs/slowSlotPool';
import { JobLane, JobType, type StageContext } from '#/jobs/types';

type LeafPayload = { key: string; ms: number; fail?: boolean };
type ParentPayload = { key: string; leaves: LeafPayload[] };
type TickPayload = { label: string };

const RUN_TIMEOUT_MS = 120_000;

const sleep = (waitMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, waitMs));

const waitUntil = async (
  label: string,
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 30_000,
) => {
  const deadlineAt = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadlineAt) throw new Error(`Timed out waiting for: ${label}`);
    await sleep(50);
  }
};

const failures: string[] = [];
const check = (label: string, isOk: boolean, detail: unknown = '') => {
  if (!isOk) failures.push(`${label} ${JSON.stringify(detail)}`);
  process.stdout.write(`${isOk ? 'ok  ' : 'FAIL'} ${label}\n`);
};

const assertDisposableTarget = (): void => {
  if (process.env.ENVIRONMENT !== 'local' || process.env.JOB_FLOW_CHECK_CONFIRM !== 'wipe') {
    throw new Error(
      'jobFlowCheck obliterates the jobs queue — run it only with ENVIRONMENT=local and JOB_FLOW_CHECK_CONFIRM=wipe against a disposable Redis db',
    );
  }
};

const main = async (): Promise<void> => {
  assertDisposableTarget();
  await queue.obliterate({ force: true });

  const runId = Bun.randomUUIDv7().slice(-8);
  const name = (label: string) => `flowCheck-${label}-${runId}`;
  const events: Array<{ at: number; what: string; key: string }> = [];
  const record = (what: string, key: string) => events.push({ at: Date.now(), what, key });
  const count = (what: string, key: string) =>
    events.filter((e) => e.what === what && e.key === key).length;

  const leaf = name('leaf');
  const plainParent = name('plainParent');
  const singletonParent = name('singletonParent');
  const supersedingParent = name('supersedingParent');
  const unkeyedCron = name('unkeyedCron');

  const fanOut = async (ctx: StageContext, { key, leaves }: ParentPayload) => {
    record('stage', key);
    for (const child of leaves) await ctx.enqueueChildJob(leaf as never, child as never);
  };
  const finish = async (_ctx: unknown, { key }: ParentPayload) => {
    record('finish', key);
  };

  Object.assign(jobHandlers, {
    [leaf]: makeSupersedingJob<LeafPayload>(
      makeJob<LeafPayload>(
        async (ctx, { key, ms, fail }) => {
          record('leafStart', key);
          ctx.signal?.addEventListener('abort', () => record('leafAborted', key));
          await sleep(ms);
          if (fail) throw new Error(`leaf ${key} fails on purpose`);
          if (!ctx.signal?.aborted) record('leafDone', key);
        },
        { lane: JobLane.slow },
      ),
      ({ key }) => key,
    ),
    [plainParent]: makeJob<ParentPayload>({ stages: [fanOut], finish }),
    [singletonParent]: makeSingletonJob<ParentPayload>(
      { stages: [fanOut], finish },
      { lockKey: ({ key }) => key },
    ),
    [supersedingParent]: makeSupersedingJob<ParentPayload>(
      { stages: [fanOut], finish },
      ({ key }) => key,
    ),
    [unkeyedCron]: makeSingletonJob<TickPayload>(async (_ctx, { label }) => {
      record('cronRun', label);
      await sleep(1_500);
    }),
  });

  const enqueue = (handler: string, payload: unknown) =>
    enqueueJob(handler as never, payload as never);

  const workerRedis = createRedisConnection('check:jobFlowWorker', resolveBullmqRedisUrl());
  const worker = new Worker(
    queue.name,
    (job: Job) => processJob(job, { slowSlots: createSlowSlotPool(10) }),
    { connection: workerRedis, concurrency: 10 },
  );
  worker.on('failed', (job, err) => record('jobFailed', `${job?.name}:${err.message}`));

  try {
    const plain = await enqueue(plainParent, {
      key: 'plain',
      leaves: [
        { key: 'plain-1', ms: 300 },
        { key: 'plain-2', ms: 600 },
        { key: 'plain-3', ms: 900 },
      ],
    });
    let sawParked = false;
    await waitUntil('plain parent finishes', async () => {
      const job = plain.jobId ? await queue.getJob(plain.jobId) : undefined;
      if ((await job?.getState()) === 'waiting-children') sawParked = true;
      return count('finish', 'plain') > 0;
    });
    const lastLeafDone = Math.max(
      ...events.filter((e) => e.what === 'leafDone' && e.key.startsWith('plain-')).map((e) => e.at),
    );
    const finishedAt = events.find((e) => e.what === 'finish' && e.key === 'plain')?.at ?? 0;
    check('staged: parent parked in waiting-children while its leaves ran', sawParked);
    check('staged: the stage ran once', count('stage', 'plain') === 1, count('stage', 'plain'));
    check('staged: finish ran once', count('finish', 'plain') === 1);
    check('staged: finish ran after the last leaf', finishedAt >= lastLeafDone, {
      finishedAt,
      lastLeafDone,
    });

    await enqueue(plainParent, {
      key: 'failing',
      leaves: [
        { key: 'failing-ok', ms: 100 },
        { key: 'failing-bad', ms: 100, fail: true },
      ],
    });
    await waitUntil(
      'parent with a failing child finishes',
      () => count('finish', 'failing') > 0,
      60_000,
    );
    check(
      'staged: a child that fails every attempt does not hold its parent open',
      count('finish', 'failing') === 1,
    );
    check(
      'staged: the failing child was retried before it counted as done',
      count('leafStart', 'failing-bad') === 3,
      count('leafStart', 'failing-bad'),
    );

    const singletonPayload = { key: 'single', leaves: [{ key: 'single-1', ms: 1_500 }] };
    await enqueue(singletonParent, singletonPayload);
    await waitUntil('singleton parent parks', () => count('leafStart', 'single-1') > 0);
    await enqueue(singletonParent, singletonPayload);
    await waitUntil('singleton parent finishes', () => count('finish', 'single') > 0);
    await sleep(500);
    check(
      'staged singleton: a second enqueue while it was parked was skipped',
      count('stage', 'single') === 1,
      count('stage', 'single'),
    );
    check('staged singleton: finish ran once', count('finish', 'single') === 1);
    await enqueue(singletonParent, { key: 'single', leaves: [{ key: 'single-2', ms: 100 }] });
    await waitUntil('singleton parent runs again once closed', () => count('finish', 'single') > 1);
    check(
      'staged singleton: the key frees once the parent finishes',
      count('stage', 'single') === 2,
    );

    await enqueue(supersedingParent, {
      key: 'race',
      leaves: [
        { key: 'race-old-1', ms: 5_000 },
        { key: 'race-old-2', ms: 5_000 },
      ],
    });
    await waitUntil(
      'old leaves running',
      () => count('leafStart', 'race-old-1') > 0 && count('leafStart', 'race-old-2') > 0,
    );
    const supersededAt = Date.now();
    await enqueue(supersedingParent, { key: 'race', leaves: [{ key: 'race-new-1', ms: 200 }] });
    await waitUntil('new superseding parent finishes', () => count('finish', 'race') > 0);
    await waitUntil(
      'old leaves aborted',
      () => count('leafAborted', 'race-old-1') > 0 && count('leafAborted', 'race-old-2') > 0,
      5_000,
    );
    const abortedAt = Math.max(
      ...events
        .filter((e) => e.what === 'leafAborted' && e.key.startsWith('race-old'))
        .map((e) => e.at),
    );
    await sleep(6_000);
    check(
      'superseding: running children of the replaced parent were aborted',
      abortedAt - supersededAt < 2_000,
      abortedAt - supersededAt,
    );
    check(
      'superseding: the replaced parent never ran finish',
      count('finish', 'race') === 1,
      count('finish', 'race'),
    );
    check(
      'superseding: the aborted leaves never wrote',
      count('leafDone', 'race-old-1') + count('leafDone', 'race-old-2') === 0,
    );
    check('superseding: the new parent ran its stage', count('leafDone', 'race-new-1') === 1);

    const tick = {
      type: JobType.cron,
      id: `cron-${runId}`,
      lane: JobLane.fast,
      payload: { label: 'tick' },
    };
    await queue.add(unkeyedCron, tick);
    await waitUntil('cron run starts', () => count('cronRun', 'tick') > 0);
    await queue.add(unkeyedCron, tick);
    await sleep(2_500);
    check(
      'cron: a tick enqueues the real run, and a second tick while it runs is skipped',
      count('cronRun', 'tick') === 1,
      count('cronRun', 'tick'),
    );

    const failed = events.filter(
      (e) => e.what === 'jobFailed' && !e.key.includes('fails on purpose'),
    );
    check('no job failed unexpectedly', failed.length === 0, failed);
  } finally {
    await worker.close();
    await workerRedis.quit();
    await queue.obliterate({ force: true });
    await queue.close();
  }

  if (failures.length > 0) {
    process.stdout.write(`\n${failures.length} check(s) failed:\n${failures.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('\nAll job flow checks passed.\n');
  process.exit(0);
};

const timeout = setTimeout(() => {
  process.stdout.write(`jobFlowCheck did not finish within ${RUN_TIMEOUT_MS} ms\n`);
  process.exit(1);
}, RUN_TIMEOUT_MS);
timeout.unref();

main().catch((err) => {
  process.stdout.write(`jobFlowCheck crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
