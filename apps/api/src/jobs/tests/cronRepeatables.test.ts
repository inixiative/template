import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createCronJob, getNextSeq } from '@template/db/test';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import type { JobsQueue } from '#/jobs/types';

const fakeQueue = (existingKeys: string[]) => {
  const removedKeys: string[] = [];
  const queue = {
    add: async (name: string, _data: unknown, options: { repeat: { jobId: string } }) => ({
      repeatJobKey: `${name}:${options.repeat.jobId}`,
    }),
    getRepeatableJobs: async () => existingKeys.map((key) => ({ key, name: key, pattern: null })),
    removeRepeatableByKey: async (key: string) => {
      removedKeys.push(key);
      return true;
    },
  } as unknown as JobsQueue;
  return { queue, removedKeys };
};

describe('registerCronJobs removes orphaned repeatables', () => {
  afterEach(async () => {
    await db.cronJob.deleteMany({});
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('removes repeatables no enabled row registers', async () => {
    await createCronJob({ name: `kept-${getNextSeq()}`, jobId: 'kept', handler: 'sweepSegments' });
    await createCronJob({
      name: `disabled-${getNextSeq()}`,
      jobId: 'disabled',
      handler: 'cleanStaleData',
      enabled: false,
    });
    const { queue, removedKeys } = fakeQueue([
      'sweepSegments:kept',
      'renamedHandler:renamed',
      'cleanStaleData:disabled',
    ]);

    await registerCronJobs(queue);

    expect(removedKeys.sort()).toEqual(['cleanStaleData:disabled', 'renamedHandler:renamed']);
  });

  it('removes nothing when a row fails to register', async () => {
    await createCronJob({ name: `kept-${getNextSeq()}`, jobId: 'kept', handler: 'sweepSegments' });
    const { queue, removedKeys } = fakeQueue(['sweepSegments:kept', 'renamedHandler:renamed']);
    queue.add = (async () => {
      throw new Error('redis down');
    }) as never;

    await registerCronJobs(queue);

    expect(removedKeys).toEqual([]);
  });
});
