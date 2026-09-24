import { describe, expect, it } from 'bun:test';
import { processJob } from '#/jobs/processJob';
import { type JobData, JobLane, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const jobWith = (id: string, data: Partial<JobData> & { lane?: JobLane }) =>
  createMockJob({ id, name: 'sendWebhook', data: { type: JobType.adhoc, payload: { id }, ...data } });

describe('processJob', () => {
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

  it('rejects an unknown handler', async () => {
    await expect(processJob(createMockJob({ name: 'noSuchHandler', data: {} }))).rejects.toThrow(
      'Unknown job handler: noSuchHandler',
    );
  });
});
