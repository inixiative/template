import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { type Job, WaitingChildrenError } from 'bullmq';
import { enqueueJob } from '#/jobs/enqueue';
import type { CleanStaleDataPayload } from '#/jobs/handlers/cleanStaleData';
import { makeJob } from '#/jobs/makeJob';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { queue } from '#/jobs/queue';
import {
  type JobData,
  JobLane,
  JobType,
  type StageContext,
  type WorkerContext,
} from '#/jobs/types';
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

const contextFor = (job: Job): WorkerContext => ({ db, queue, job });

describe('makeJob({ stages, finish })', () => {
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

  it('runs straight through when no stage adds children', async () => {
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

  it('runs every stage and finish in order inline, and a failing child does not fail its parent', async () => {
    const failingChild: CleanStaleDataPayload = {
      model: 'User',
      retentionDays: 1,
      archive: { target: 's3' },
    };
    await expect(enqueueJob('cleanStaleData', failingChild)).rejects.toThrow('Archive not yet');

    const ran: string[] = [];
    const job = flowParent(undefined);
    const staged = makeJob<Record<string, never>>({
      stages: [
        async (ctx) => {
          ran.push('first');
          await ctx.enqueueChildJob('cleanStaleData', failingChild);
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

    await staged(contextFor(job), {});

    expect(ran).toEqual(['first', 'second', 'finish']);
    expect(job.data.stage).toBeUndefined();
    expect(job.state).toBe('active');
  });

  const supersedingParent = (job: FlowParent, addChild: (ctx: StageContext) => Promise<void>) =>
    makeSupersedingJob<Record<string, never>>(
      {
        stages: [
          async (ctx) => {
            await addChild(ctx);
            job.hasUnfinishedChildren = true;
          },
        ],
        finish: async () => {},
      },
      () => 'one-lane',
    );

  it('a superseding job refuses a child that cannot be superseded, before adding it', async () => {
    const job = flowParent(undefined);
    const staged = supersedingParent(job, (ctx) =>
      ctx.enqueueChildJob('cleanStaleData', { model: 'User', retentionDays: 1 }),
    );

    expect(staged.isStaged).toBe(true);
    await expect(staged(contextFor(job), {})).rejects.toThrow(
      `A superseding job's children must be superseding jobs, and "cleanStaleData" is not`,
    );
    expect(job.hasUnfinishedChildren).toBe(false);
  });

  it('a superseding job accepts a superseding child', async () => {
    const job = flowParent(undefined);
    const staged = supersedingParent(job, (ctx) =>
      ctx.enqueueChildJob('reconcileSegment', { segmentId: Bun.randomUUIDv7() }),
    );

    await staged(contextFor(job), {});

    expect(job.hasUnfinishedChildren).toBe(true);
  });
});
