import { afterEach, describe, expect, it } from 'bun:test';
import { setEnvOverride } from '@template/shared/utils';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { bulkCapacity, claimBulkSlot } from '#/jobs/slowLane/capacity';
import { type JobData, JobLane, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const jobWith = (id: string, data: Partial<JobData> & { lane?: JobLane }) =>
  createMockJob({ id, name: 'sendWebhook', data: { type: JobType.adhoc, payload: {}, ...data } });

describe('processJob lane dispatch', () => {
  afterEach(async () => {
    await queue.redis.flushdb();
  });

  it('runs a slow envelope inside a fleet slot', async () => {
    let occupiedDuringRun = -1;
    await processJob(jobWith('slow-job', { lane: JobLane.slow }), {
      handlers: {
        sendWebhook: async () => {
          occupiedDuringRun = (await bulkCapacity(queue.redis)).occupied;
        },
      },
      slowLane: { feed: async () => {} },
    });

    expect(occupiedDuringRun).toBe(1);
    expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
  });

  it('runs fast and legacy lane-less envelopes directly, without touching slots', async () => {
    setEnvOverride('BULK_SLOTS', '1');
    await claimBulkSlot(queue.redis, 'fleet-full');
    const ran: string[] = [];
    const handlers = {
      sendWebhook: async () => {
        ran.push('ran');
      },
    };

    await processJob(jobWith('fast-job', { lane: JobLane.fast }), { handlers });
    await processJob(jobWith('legacy-job', {}), { handlers });

    expect(ran).toEqual(['ran', 'ran']);
  });

  it('rejects an unknown handler', async () => {
    await expect(processJob(createMockJob({ name: 'noSuchHandler', data: {} }))).rejects.toThrow(
      'Unknown job handler: noSuchHandler',
    );
  });
});
