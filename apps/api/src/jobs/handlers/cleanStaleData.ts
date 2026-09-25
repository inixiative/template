/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import { type ModelName, runtimeDelegate } from '@template/db';
import { log } from '@template/shared/logger';
import { type ArchiveConfig, archiveStaleRecords } from '#/jobs/handlers/archiveStaleRecords';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { JobHandler, WorkerContext } from '#/jobs/types';

// Generic stale-data cleanup. One handler, N cron rows — each row points at a
// model + retention + (optional) filter in its payload. Add a new cleanup
// schedule by inserting a CronJob row, no new handler needed.
//
// Defaults to `createdAt` for the cutoff column; override via `dateField` for
// models that track staleness on a different timestamp (lastSeenAt, expiresAt).
//
// archive (optional) routes records to cold storage / a data lake before delete.
// Today the impl is a stub that throws — configuring archive in a cron payload
// makes the job fail loudly until the archive target is implemented, so no
// silent data loss.

export type CleanStaleDataPayload = {
  model: ModelName;
  retentionDays: number;
  dateField?: string;
  filters?: Record<string, unknown>;
  archive?: ArchiveConfig;
};

export const cleanStaleData: JobHandler<CleanStaleDataPayload> = makeSingletonJob(
  async (ctx: WorkerContext, payload: CleanStaleDataPayload) => {
    const { db } = ctx;
    const { model, retentionDays, dateField = 'createdAt', filters = {}, archive } = payload;

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const where = { ...filters, [dateField]: { lt: cutoffDate } };

    if (archive) {
      await archiveStaleRecords(model, where, archive);
    }

    const delegate = runtimeDelegate(db, model);
    if (!delegate) throw new Error(`cleanStaleData: no Prisma delegate for model "${model}"`);

    const result = await delegate.deleteMany({ where });
    log.info(`cleanStaleData: deleted ${result.count} ${model} rows older than ${retentionDays} days`);
  },
);
