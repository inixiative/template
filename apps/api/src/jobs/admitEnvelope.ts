/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { claimLane, laneKey, releaseLane } from '@template/db';
import { log } from '@template/shared/logger';
import { withLanePriority } from '#/jobs/lanePriority';
import { isLaneOverflowing, outboxLaneOf, shouldSpill, spillToOutbox, tripIfFull } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import { type JobData, type JobOptions, JobType } from '#/jobs/types';

export type EnvelopeAdmission = {
  handlerName: string;
  jobId: string;
  data: JobData;
  options: JobOptions;
  bypass: boolean;
};

export type EnvelopeAdmissionResult = { jobId: string; outboxed?: true };

export const admitEnvelope = async ({
  handlerName,
  jobId,
  data,
  options,
  bypass,
}: EnvelopeAdmission): Promise<EnvelopeAdmissionResult> => {
  const baton = data.dedupeKey ? laneKey(handlerName, data.dedupeKey) : undefined;
  const lane = outboxLaneOf({ data });
  const jobOptions = withLanePriority(data, options);
  const overflowing = data.type === JobType.adhoc && !bypass && (await isLaneOverflowing(lane));

  if (shouldSpill(data.type, bypass, overflowing)) {
    // Claim at SPILL time too, not just at drain: the newest enqueue must hold the baton even while
    // buffered, so an older in-flight run aborts now instead of finishing with stale data during the
    // outbox dwell. The drain re-claims under the same jobId when it re-adds (self-claim, no-op).
    const previousHolder = baton ? await claimLane(baton, jobId, jobOptions.delay) : null;
    try {
      await spillToOutbox({ handlerName, jobId, dedupeKey: data.dedupeKey ?? null, data, options: jobOptions });
    } catch (err) {
      if (baton) await releaseLane(baton, jobId, previousHolder).catch(() => {});
      throw err;
    }
    log.info(`Spilled job ${handlerName} to outbox (${jobId}, ${lane} lane over pressure)`);
    return { jobId, outboxed: true };
  }

  // Claim the lane BEFORE adding so the job holds the baton the instant it starts. If the add then
  // fails, no job exists to hold the baton — roll the claim back (fenced, so a concurrent claim isn't
  // clobbered) rather than leaving the prior job superseded by a phantom that never ran. The claim's
  // TTL stretches by the job's `delay` — the baton must survive until the job actually runs.
  let previousHolder: string | null = null;
  try {
    if (baton) previousHolder = await claimLane(baton, jobId, jobOptions.delay);
    await queue.add(handlerName, data, { ...jobOptions, jobId });
  } catch (err) {
    if (baton) await releaseLane(baton, jobId, previousHolder).catch(() => {});
    throw err;
  }
  if (data.type === JobType.adhoc) await tripIfFull();

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId };
};
