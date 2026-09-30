import { afterEach, describe, expect, it } from 'bun:test';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { slowLastFinishedKey } from '#/jobs/slowLaneSignals';
import { createSlowSlotPool } from '#/jobs/slowSlotPool';
import { type JobData, JobLane, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const jobWith = (id: string, data: Partial<JobData> & { lane?: JobLane }) =>
  createMockJob({
    id,
    name: 'sendWebhook',
    data: { type: JobType.adhoc, payload: { id }, ...data },
  });

describe('processJob', () => {
  afterEach(async () => {
    await queue.redis.flushdb();
  });

  it('runs the handler for every lane, including legacy lane-less envelopes', async () => {
    const ran: unknown[] = [];
    const handlers = {
      sendWebhook: async (_ctx: unknown, payload: unknown) => {
        ran.push(payload);
      },
    };

    await processJob(jobWith('slow-job', { lane: JobLane.slow }), { handlers: handlers as never });
    await processJob(jobWith('fast-job', { lane: JobLane.fast }), { handlers: handlers as never });
    await processJob(jobWith('legacy-job', {}), { handlers: handlers as never });

    expect(ran).toEqual([{ id: 'slow-job' }, { id: 'fast-job' }, { id: 'legacy-job' }]);
  });

  it('releases the slow slot and stamps the slow finish when a slow handler throws', async () => {
    const slowSlots = createSlowSlotPool(2);
    const handlers = {
      sendWebhook: async () => {
        throw new Error('handler failed');
      },
    };

    await expect(
      processJob(jobWith('slow-fails', { lane: JobLane.slow }), {
        handlers: handlers as never,
        slowSlots,
      }),
    ).rejects.toThrow('handler failed');

    expect(slowSlots.held()).toBe(0);
    expect(await queue.redis.get(slowLastFinishedKey(queue.name))).not.toBeNull();
  });

  it('stamps no slow finish for a fast job', async () => {
    const handlers = { sendWebhook: async () => {} };

    await processJob(jobWith('fast-job', { lane: JobLane.fast }), { handlers: handlers as never });

    expect(await queue.redis.get(slowLastFinishedKey(queue.name))).toBeNull();
  });

  it('rejects an unknown handler', async () => {
    await expect(processJob(createMockJob({ name: 'noSuchHandler', data: {} }))).rejects.toThrow(
      'Unknown job handler: noSuchHandler',
    );
  });
});
