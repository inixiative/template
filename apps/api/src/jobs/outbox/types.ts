/**
 * @atlas
 * @kind type
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { isSlowJobData } from '#/jobs/buildJobData';
import { type JobData, JobLane, type JobOptions, JobType } from '#/jobs/types';

export type OutboxRow = {
  handlerName: string;
  jobId: string;
  dedupeKey: string | null;
  data: JobData;
  options: JobOptions;
};

export type SpillOptions = {
  flushImmediately?: boolean;
};

export const outboxLaneOf = (row: Pick<OutboxRow, 'data'>): JobLane =>
  isSlowJobData(row.data) ? JobLane.slow : JobLane.fast;

export const toCreateInput = (row: OutboxRow): Prisma.JobOutboxCreateManyInput => ({
  handlerName: row.handlerName,
  jobId: row.jobId,
  dedupeKey: row.dedupeKey,
  lane: outboxLaneOf(row),
  data: row.data as Prisma.InputJsonValue,
  options: row.options as Prisma.InputJsonValue,
});

// Spill routing decision (pure, so it's testable without the queue): adhoc only,
// never when bypassed, only while overflowing. Cron/cronTrigger always go direct.
export const shouldSpill = (type: JobType, bypass: boolean, overflowing: boolean): boolean =>
  type === JobType.adhoc && !bypass && overflowing;
