/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { claimLane, laneKey, releaseLane } from '@template/db';
import { log } from '@template/shared/logger';
import { isSlowJobData } from '#/jobs/buildJobData';
import { isOverflowing, shouldSpill, spillToOutbox, tripIfFull } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import { claimBulkSlot, releaseBulkSlot } from '#/jobs/slowLane/capacity';
import { type JobData, type JobOptions, JobType } from '#/jobs/types';

export type EnvelopeAdmission = {
  handlerName: string;
  jobId: string;
  data: JobData;
  options: JobOptions;
  bypass: boolean;
};

export type EnvelopeAdmissionResult = { jobId: string; outboxed?: true };

// A slow job enters BullMQ only once it holds a fleet slot: without one it waits in the outbox,
// where a finishing slow job (or the drain) admits it. Delayed and bypassed slow jobs skip the
// reservation — a delay would hold a slot idle — and claim when they start instead.
const reservesSlowSlot = (data: JobData, options: JobOptions, bypass: boolean): boolean =>
  isSlowJobData(data) && !bypass && options.delay === undefined;

export const admitEnvelope = async ({
  handlerName,
  jobId,
  data,
  options,
  bypass,
}: EnvelopeAdmission): Promise<EnvelopeAdmissionResult> => {
  const lane = data.dedupeKey ? laneKey(handlerName, data.dedupeKey) : undefined;
  const reservesSlot = reservesSlowSlot(data, options, bypass);

  const hasSlot = reservesSlot && (await claimBulkSlot(queue.redis, jobId)).claimed;
  const buffersForSlot = reservesSlot && !hasSlot;
  const buffersForOverflow =
    !reservesSlot && shouldSpill(data.type, bypass, data.type === JobType.adhoc && !bypass && (await isOverflowing()));

  if (buffersForSlot || buffersForOverflow) {
    // Claim at SPILL time too, not just at drain: the newest enqueue must hold the baton even while
    // buffered, so an older in-flight run aborts now instead of finishing with stale data during the
    // outbox dwell. The drain re-claims under the same jobId when it re-adds (self-claim, no-op).
    const previousHolder = lane ? await claimLane(lane, jobId, options.delay) : null;
    try {
      await spillToOutbox({ handlerName, jobId, dedupeKey: data.dedupeKey ?? null, data, options });
    } catch (err) {
      if (lane) await releaseLane(lane, jobId, previousHolder).catch(() => {});
      throw err;
    }
    log.info(
      `Spilled job ${handlerName} to outbox (${jobId}, ${buffersForSlot ? 'waiting for a slow slot' : 'overflow'})`,
    );
    return { jobId, outboxed: true };
  }

  // Claim the lane BEFORE adding so the job holds the baton the instant it starts. If the add then
  // fails, no job exists to hold the baton — roll the claim back (fenced, so a concurrent claim isn't
  // clobbered) rather than leaving the prior job superseded by a phantom that never ran. The claim's
  // TTL stretches by the job's `delay` — the baton must survive until the job actually runs.
  let previousHolder: string | null = null;
  try {
    if (lane) previousHolder = await claimLane(lane, jobId, options.delay);
    await queue.add(handlerName, data, { ...options, jobId });
  } catch (err) {
    if (lane) await releaseLane(lane, jobId, previousHolder).catch(() => {});
    if (hasSlot) await releaseBulkSlot(queue.redis, jobId).catch(() => {});
    throw err;
  }
  if (data.type === JobType.adhoc && !isSlowJobData(data)) await tripIfFull();

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId };
};
