/**
 * @atlas
 * @kind utils
 * @partOf feature:email, primitive:jobs
 * @uses infrastructure:env
 */
import '#/config/env';
import { JobLane } from '#/jobs/types';

export const emailJobLaneForRecipientCount = (recipientCount: number): JobLane =>
  recipientCount > process.env.EMAIL_SLOW_LANE_MIN_RECIPIENTS ? JobLane.slow : JobLane.fast;
