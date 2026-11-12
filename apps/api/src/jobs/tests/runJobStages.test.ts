import { afterEach, describe, expect, it } from 'bun:test';
import { type Job, WaitingChildrenError } from 'bullmq';
import type { CleanStaleDataPayload } from '#/jobs/handlers/cleanStaleData';
import { makeJob } from '#/jobs/makeJob';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { queue } from '#/jobs/queue';
import { type JobData, JobLane, JobType, type WorkerContext } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

type FlowParent = Job<JobData> & { state: string; hasUnfinishedChildren: boolean };

// A stateful stand-in for a BullMQ flow parent: `updateData` keeps the envelope, and
// `moveToWaitingChildren` parks the job only while a child is still unfinished, as BullMQ does.
const flowParent = (token: string | undefined): FlowParent => {
  const job = createMockJob({
    id: 'parent-job',
    name: 'stagedTest',
    data: { type: JobType.adhoc, lane: JobLane.fast, payload: {} },
    token,
    queueQualifiedName: 'bull:jobs',
  } as Partial<Job>) as FlowParent;
  job.state = 'active';
  job.hasUnfinishedChildren = false;
  job.updateData = async (data) => {
    job.data = data;
  };
  job.moveToWaitingChildren = async () => {
    if (!job.hasUnfinishedChildren) return false;
    job.state = 'waiting-children';
    return true;
  };
  return job;
};

const contextFor = (job: Job): WorkerContext => ({ queue, job });

describe('{ stages, finish } (runJobStages)', () => {
  afterEach(async () => {
    await queue.redis.flushdb();
  });

  it('parks after a stage that added children, then resumes at the next stage without rerunning the first', async () => {
    const ran: string[] = [];
    const job = flowParent('worker-token');
    const staged = makeJob<Record<string, never>>({
      stages: [
        async (ctx) => {
          ran.push('first');
          await ctx.enqueueChildJob('reconcileSegment', { segmentId: Bun.randomUUIDv7() });
          job.hasUnfinishedChildren = true;
        },
        async () => {
          ran.push('second');
        },
      ],
      finish: async () => {
        ran.push('finish');
      },
    });

    await expect(staged(contextFor(job), {})).rejects.toBeInstanceOf(WaitingChildrenError);
    expect(ran).toEqual(['first']);
    expect(job.data.stage).toBe(1);
    expect(job.state).toBe('waiting-children');

    job.state = 'active';
    job.hasUnfinishedChildren = false;
    await staged(contextFor(job), {});

    expect(ran).toEqual(['first', 'second', 'finish']);
    expect(job.data.stage).toBe(2);
  });

  it('runs straight through when a stage adds no children', async () => {
    const ran: string[] = [];
    const job = flowParent('worker-token');
    const staged = makeJob<Record<string, never>>({
      stages: [
        async () => {
          ran.push('first');
        },
        async () => {
          ran.push('second');
        },
      ],
      finish: async () => {
        ran.push('finish');
      },
    });

    await staged(contextFor(job), {});

    expect(ran).toEqual(['first', 'second', 'finish']);
    expect(job.state).toBe('active');
    expect(job.data.stage).toBe(2);
  });

  it('a resumed run parks before the next stage while the previous stage still has unfinished children', async () => {
    const ran: string[] = [];
    const job = flowParent('worker-token');
    job.data = { ...job.data, stage: 1 };
    job.hasUnfinishedChildren = true;
    const staged = makeJob<Record<string, never>>({
      stages: [
        async () => {
          ran.push('first');
        },
        async () => {
          ran.push('second');
        },
      ],
      finish: async () => {
        ran.push('finish');
      },
    });

    await expect(staged(contextFor(job), {})).rejects.toBeInstanceOf(WaitingChildrenError);
    expect(ran).toEqual([]);
    expect(job.state).toBe('waiting-children');
  });

  it('inline, a child that throws fails its parent', async () => {
    const failingChild: CleanStaleDataPayload = {
      model: 'User',
      retentionDays: 1,
      archive: { target: 's3' },
    };

    const ran: string[] = [];
    const job = flowParent(undefined);
    const staged = makeJob<Record<string, never>>({
      stages: [
        async (ctx) => {
          ran.push('first');
          await ctx.enqueueChildJob('cleanStaleData', failingChild);
        },
        async () => {
          ran.push('second');
        },
      ],
      finish: async () => {
        ran.push('finish');
      },
    });

    await expect(staged(contextFor(job), {})).rejects.toThrow('Archive not yet');
    expect(ran).toEqual(['first']);
  });

  it('a singleton takes stages too, and runs them under its lock', async () => {
    const ran: string[] = [];
    const job = flowParent(undefined);
    const staged = makeSingletonJob<{ key: string }>(
      {
        stages: [
          async () => {
            ran.push('stage');
          },
        ],
        finish: async () => {
          ran.push('finish');
        },
      },
      { lockKey: ({ key }) => key },
    );

    await staged(contextFor(job), { key: 'one' });

    expect(ran).toEqual(['stage', 'finish']);
  });

  it('a superseding job refuses a child that cannot be superseded, before adding it', async () => {
    const job = flowParent(undefined);
    const staged = makeSupersedingJob<Record<string, never>>(
      {
        stages: [
          async (ctx) => {
            await ctx.enqueueChildJob('cleanStaleData', { model: 'User', retentionDays: 1 });
          },
        ],
        finish: async () => {},
      },
      () => 'one-lane',
    );

    await expect(staged(contextFor(job), {})).rejects.toThrow(
      `A superseding job's children must be superseding jobs, and "cleanStaleData" is not`,
    );
  });

  it('a superseding job may add superseding children', async () => {
    const ran: string[] = [];
    const job = flowParent(undefined);
    const staged = makeSupersedingJob<Record<string, never>>(
      {
        stages: [
          async (ctx) => {
            await ctx.enqueueChildJob('reconcileSegment', { segmentId: Bun.randomUUIDv7() });
            ran.push('stage');
          },
        ],
        finish: async () => {
          ran.push('finish');
        },
      },
      () => 'superseding-children-lane',
    );

    await staged(contextFor(job), {});

    expect(ran).toEqual(['stage', 'finish']);
  });
});
