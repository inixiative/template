import { describe, expect, it } from 'bun:test';
import { buildJobData, isSlowJobData } from '#/jobs/buildJobData';
import { makeJob } from '#/jobs/makeJob';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { JobLane, JobType } from '#/jobs/types';

const request = { type: JobType.adhoc, payload: { a: 1 } };

describe('buildJobData lane precedence', () => {
  const slowByDefault = makeJob(async () => {}, { lane: JobLane.slow });
  const undeclared = makeJob(async () => {});

  it('request lane wins over everything', () => {
    expect(buildJobData(slowByDefault, { ...request, lane: JobLane.fast }, JobLane.slow).lane).toBe(JobLane.fast);
  });

  it('enqueue option wins over the handler default', () => {
    expect(buildJobData(slowByDefault, request, JobLane.fast).lane).toBe(JobLane.fast);
  });

  it('handler default applies when nothing overrides it', () => {
    expect(buildJobData(slowByDefault, request).lane).toBe(JobLane.slow);
  });

  it('an undeclared handler is fast', () => {
    expect(buildJobData(undeclared, request).lane).toBe(JobLane.fast);
  });

  it('keeps the rest of the envelope intact', () => {
    expect(
      buildJobData(undeclared, { ...request, id: 'cron-1', dedupeKey: 'k', traceContext: { traceparent: 't' } }),
    ).toEqual({
      id: 'cron-1',
      type: JobType.adhoc,
      lane: JobLane.fast,
      payload: { a: 1 },
      dedupeKey: 'k',
      traceContext: { traceparent: 't' },
    });
  });
});

describe('lane on constructed handlers', () => {
  it('singleton and superseding wrappers carry the declared lane', () => {
    const slow = makeJob<{ id: string }>(async () => {}, { lane: JobLane.slow });
    expect(makeSingletonJob(slow).lane).toBe(JobLane.slow);
    expect(makeSupersedingJob(slow, (payload) => payload.id).lane).toBe(JobLane.slow);
  });
});

describe('isSlowJobData', () => {
  it('treats only an explicit slow lane as slow — legacy envelopes with no lane are fast', () => {
    expect(isSlowJobData({ lane: JobLane.slow })).toBe(true);
    expect(isSlowJobData({ lane: JobLane.fast })).toBe(false);
    expect(isSlowJobData({})).toBe(false);
    expect(isSlowJobData(undefined)).toBe(false);
  });
});
