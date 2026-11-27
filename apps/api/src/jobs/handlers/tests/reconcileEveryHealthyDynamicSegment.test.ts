import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSegment,
  createSpace,
} from '@template/db/test';
import { jobHandlers } from '#/jobs/handlers';
import { type JobData, JobLane, type WorkerContext } from '#/jobs/types';
import { makeTestWorker } from '#tests/makeTestWorker';

const acmeEmailDomainRule = {
  field: 'customerUser.email',
  operator: Operator.endsWith,
  value: '@acme.test',
};

describe('reconcileEveryHealthyDynamicSegment', () => {
  let space: Space;

  beforeEach(async () => {
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('enqueues every per-segment reconcile in the slow lane', async () => {
    const segments = await Promise.all(
      [0, 1].map(
        async () =>
          (
            await createSegment(
              { ownerModel: 'Space', type: SegmentType.dynamic, conditions: acmeEmailDomainRule },
              { space },
            )
          ).entity,
      ),
    );
    const enqueued: { segmentId: string; data: JobData }[] = [];
    const reconcile = spyOn(jobHandlers, 'reconcileSegment').mockImplementation(
      async (ctx: WorkerContext, payload: { segmentId: string }) => {
        enqueued.push({ segmentId: payload.segmentId, data: ctx.job.data });
      },
    );
    try {
      await makeTestWorker({
        name: 'reconcileEveryHealthyDynamicSegment',
        id: Bun.randomUUIDv7(),
      }).run();
    } finally {
      reconcile.mockRestore();
    }

    const ours = enqueued.filter((run) => segments.some((segment) => segment.id === run.segmentId));
    expect(ours).toHaveLength(2);
    expect(ours.every((run) => run.data.lane === JobLane.slow)).toBe(true);
  });
});
