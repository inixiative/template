import { beforeEach, describe, expect, it } from 'bun:test';
import { claimLane, getJobSupersededBy, laneKey } from '@template/db';
import type { Job } from 'bullmq';
import { evictSupersededFlow } from '#/jobs/evictSupersededFlow';
import { queue } from '#/jobs/queue';
import { JobLane, type JobsQueue, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const QUEUE_QUALIFIED_NAME = 'bull:jobs';

const childJob = (id: string, dedupeKey: string): Job =>
  createMockJob({
    id,
    name: 'refreshTarget',
    data: { type: JobType.adhoc, lane: JobLane.slow, payload: {}, dedupeKey },
  });

// A flow parent in a given state, listing its unfinished children the way BullMQ does: as job keys
// under the queue's qualified name.
const parentJob = (id: string, state: string, children: Job[]): Job => {
  const job = createMockJob({
    id,
    name: 'refreshAll',
    queueQualifiedName: QUEUE_QUALIFIED_NAME,
  } as Partial<Job>);
  job.getState = (async () => state) as Job['getState'];
  job.getDependencies = async () => ({
    unprocessed: children.map(({ id: childId }) => `${QUEUE_QUALIFIED_NAME}:${childId}`),
    nextUnprocessedCursor: 0,
  });
  return job;
};

const queueHolding = (jobs: Job[]): Pick<JobsQueue, 'getJob'> =>
  ({ getJob: async (id: string) => jobs.find((job) => job.id === id) }) as Pick<
    JobsQueue,
    'getJob'
  >;

describe('evictSupersededFlow', () => {
  beforeEach(async () => {
    await queue.redis.flushdb();
  });

  it('supersedes every unfinished child of a parked parent, running or waiting, through its lane', async () => {
    const running = childJob('child-running', 'key-a');
    const waiting = childJob('child-waiting', 'key-b');
    await claimLane(laneKey(running.name, 'key-a'), 'child-running');
    await claimLane(laneKey(waiting.name, 'key-b'), 'child-waiting');
    const parent = parentJob('old-parent', 'waiting-children', [running, waiting]);

    expect(await evictSupersededFlow('old-parent', queueHolding([parent, running, waiting]))).toBe(
      2,
    );

    expect(await getJobSupersededBy('child-running')).toBe('evicted-old-parent');
    expect(await getJobSupersededBy('child-waiting')).toBe('evicted-old-parent');
    expect(await queue.redis.get(laneKey(running.name, 'key-a'))).toBe('evicted-old-parent');
  });

  it('leaves a parent that is not parked alone', async () => {
    const child = childJob('child', 'key-a');
    await claimLane(laneKey(child.name, 'key-a'), 'child');
    const parent = parentJob('running-parent', 'active', [child]);

    expect(await evictSupersededFlow('running-parent', queueHolding([parent, child]))).toBe(0);

    expect(await getJobSupersededBy('child')).toBeNull();
  });

  it('does nothing for a parent that is already gone', async () => {
    expect(await evictSupersededFlow('gone', queueHolding([]))).toBe(0);
  });
});
