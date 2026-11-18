import { describe, expect, it } from 'bun:test';
import { setEnvOverride } from '@template/shared/utils';
import { JobLane } from '#/jobs/types';
import { emailJobLaneForRecipientCount } from '#/lib/email/emailJobLaneForRecipientCount';

describe('emailJobLaneForRecipientCount', () => {
  it('keeps a fan-out at or under the threshold fast and puts a wider one on the slow lane', () => {
    setEnvOverride('EMAIL_SLOW_LANE_MIN_RECIPIENTS', '25');
    expect(emailJobLaneForRecipientCount(1)).toBe(JobLane.fast);
    expect(emailJobLaneForRecipientCount(25)).toBe(JobLane.fast);
    expect(emailJobLaneForRecipientCount(26)).toBe(JobLane.slow);
  });

  it('defaults the threshold to 25 when the override is not a valid number', () => {
    setEnvOverride('EMAIL_SLOW_LANE_MIN_RECIPIENTS', 'many');
    expect(emailJobLaneForRecipientCount(25)).toBe(JobLane.fast);
    expect(emailJobLaneForRecipientCount(26)).toBe(JobLane.slow);
  });
});
