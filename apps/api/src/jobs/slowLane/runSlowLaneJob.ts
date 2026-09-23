/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { LogScope, log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';
import { claimBulkSlot, releaseBulkSlot, renewBulkSlot } from '#/jobs/slowLane/capacity';
import { bulkLeaseHeartbeatMs } from '#/jobs/slowLane/config';
import { feedSlowLaneSafely } from '#/jobs/slowLane/feedSlowLane';
import { spillRefusedSlowJob } from '#/jobs/slowLane/spillRefusedSlowJob';
import type { WorkerContext } from '#/jobs/types';

export type SlowLaneSeams = {
  spill?: typeof spillRefusedSlowJob;
  feed?: () => Promise<void>;
};

export const runSlowLaneJob = async (
  ctx: WorkerContext,
  run: () => Promise<void>,
  { spill = spillRefusedSlowJob, feed = feedSlowLaneSafely }: SlowLaneSeams = {},
): Promise<void> => {
  const member = ctx.job.id ?? Bun.randomUUIDv7();
  const capacity = await claimBulkSlot(ctx.queue.redis, member);

  if (!capacity.claimed) {
    await spill(ctx);
    return;
  }

  log.info(
    `Slow-lane job ${ctx.job.name} (${member}) holds a slot (cap ${capacity.cap}, live workers ${capacity.liveWorkers})`,
    LogScope.job,
  );

  const leaseStartedAt = Date.now();
  const stopHeartbeat = heartbeat(
    async () => {
      const { reacquired } = await renewBulkSlot(ctx.queue.redis, member);
      if (reacquired) {
        log.warn(
          `Slow-lane lease for ${member} had expired and was re-acquired after ${Date.now() - leaseStartedAt}ms — the job ran outside the cap in between`,
          LogScope.job,
        );
      }
    },
    bulkLeaseHeartbeatMs(),
    { onError: (err) => log.error(`Slow-lane lease renewal failed for ${member}`, err, LogScope.job) },
  );

  try {
    await run();
  } finally {
    stopHeartbeat();
    await releaseBulkSlot(ctx.queue.redis, member).catch((err) =>
      log.error(`Slow-lane slot release failed for ${member}; it expires with its lease`, err, LogScope.job),
    );
    await feed();
  }
};
