import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { log } from '@template/shared/logger';
import { DelayedError, WaitingChildrenError } from 'bullmq';
import { traceJob } from '#/jobs/traceJob';

const job = { name: 'stagedJob', id: 'job-1', attemptsMade: 0, data: {} };

describe('traceJob', () => {
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    errorSpy = spyOn(log, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs a failed attempt', async () => {
    await expect(
      traceJob(job, async () => {
        throw new Error('Delivery failed');
      }),
    ).rejects.toThrow('Delivery failed');

    expect(errorSpy).toHaveBeenCalledWith(expect.anything(), 'Job attempt failed');
  });

  it('passes a BullMQ wait signal through without logging it as a failed attempt', async () => {
    await expect(
      traceJob(job, async () => {
        throw new WaitingChildrenError();
      }),
    ).rejects.toBeInstanceOf(WaitingChildrenError);
    await expect(
      traceJob(job, async () => {
        throw new DelayedError();
      }),
    ).rejects.toBeInstanceOf(DelayedError);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns what the run returns', async () => {
    expect(await traceJob(job, async () => 'done')).toBe('done');
  });
});
