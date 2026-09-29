import { describe, expect, it } from 'bun:test';
import { setEnvOverride } from '@template/shared/utils';
import { JobLane } from '#/jobs/types';
import { fanOutLane } from '#/lib/email/fanOutLane';

describe('fanOutLane', () => {
  it('keeps a fan-out at or under the threshold fast and puts a wider one on the slow lane', () => {
    setEnvOverride('EMAIL_SLOW_LANE_MIN_RECIPIENTS', '25');
    expect(fanOutLane(1)).toBe(JobLane.fast);
    expect(fanOutLane(25)).toBe(JobLane.fast);
    expect(fanOutLane(26)).toBe(JobLane.slow);
  });

  it('defaults the threshold to 25 when the override is not a valid number', () => {
    setEnvOverride('EMAIL_SLOW_LANE_MIN_RECIPIENTS', 'many');
    expect(fanOutLane(25)).toBe(JobLane.fast);
    expect(fanOutLane(26)).toBe(JobLane.slow);
  });
});
