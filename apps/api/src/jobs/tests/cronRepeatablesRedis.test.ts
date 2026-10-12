import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { queue } from '#/jobs/queue';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import type { JobsQueue } from '#/jobs/types';

const redis = new Redis(resolveBullmqRedisUrl() ?? '', {
  lazyConnect: true,
  connectTimeout: 2000,
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});
const redisReachable = await redis.connect().then(
  () => true,
  () => false,
);
if (!redisReachable) console.warn('cronRepeatablesRedis: test REDIS_URL is unreachable, skipping');

const realQueue = Object.assign(new Queue('cron-repeatables-test', { connection: redis }), {
  redis,
}) as JobsQueue;

const repeatables = async () =>
  (await realQueue.getRepeatableJobs()).map(({ name, pattern }) => ({ name, pattern }));

describe.skipIf(!redisReachable)('cron repeatables in real Redis', () => {
  let restore = (): void => {};

  beforeAll(() => {
    registerCronJobSyncHook();
    const add = spyOn(queue, 'add').mockImplementation(((...args: Parameters<Queue['add']>) =>
      realQueue.add(...args)) as never);
    const removeRepeatable = spyOn(queue, 'removeRepeatable').mockImplementation(((
      ...args: Parameters<Queue['removeRepeatable']>
    ) => realQueue.removeRepeatable(...args)) as never);
    restore = () => {
      add.mockRestore();
      removeRepeatable.mockRestore();
    };
  });

  afterEach(async () => {
    await realQueue.obliterate({ force: true });
    await db.cronJob.deleteMany({});
  });

  afterAll(async () => {
    restore();
    clearHookRegistry();
    await realQueue.close();
    await redis.quit();
    await cleanupTouchedTables(db);
  });

  it('removes a repeatable only when jobId is the third argument', async () => {
    await realQueue.add('cleanStaleData', {}, { jobId: 'stale', repeat: { pattern: '0 0 * * *' } });

    const jobIdInRepeat = { pattern: '0 0 * * *', jobId: 'stale' };
    expect(await realQueue.removeRepeatable('cleanStaleData', jobIdInRepeat)).toBe(false);
    expect(await repeatables()).toHaveLength(1);

    expect(
      await realQueue.removeRepeatable('cleanStaleData', { pattern: '0 0 * * *' }, 'stale'),
    ).toBe(true);
    expect(await repeatables()).toEqual([]);
  });

  it('moves the repeatable when a row is edited, renamed and deleted', async () => {
    const { entity: row } = await createCronJob({
      jobId: 'cleanup',
      handler: 'cleanStaleData',
      pattern: '0 0 * * *',
    });
    expect(await repeatables()).toEqual([{ name: 'cleanStaleData', pattern: '0 0 * * *' }]);

    await db.txn(() =>
      db.cronJob.update({ where: { id: row.id }, data: { pattern: '0 4 * * *' } }),
    );
    expect(await repeatables()).toEqual([{ name: 'cleanStaleData', pattern: '0 4 * * *' }]);

    await db.txn(() =>
      db.cronJob.update({
        where: { id: row.id },
        data: { handler: 'sweepSegments', jobId: 'sweep' },
      }),
    );
    expect(await repeatables()).toEqual([{ name: 'sweepSegments', pattern: '0 4 * * *' }]);

    await db.txn(() => db.cronJob.delete({ where: { id: row.id } }));
    expect(await repeatables()).toEqual([]);
  });

  it('prunes repeatables no enabled row registers on worker start', async () => {
    await createCronJob({ jobId: 'kept', handler: 'sweepSegments', pattern: '0 1 * * *' });
    await realQueue.add(
      'renamedHandler',
      {},
      { repeat: { pattern: '0 2 * * *', jobId: 'renamed' } },
    );
    await realQueue.add('sweepSegments', {}, { repeat: { pattern: '0 3 * * *', jobId: 'kept' } });

    await registerCronJobs(realQueue);

    expect(await repeatables()).toEqual([{ name: 'sweepSegments', pattern: '0 1 * * *' }]);
  });
});
