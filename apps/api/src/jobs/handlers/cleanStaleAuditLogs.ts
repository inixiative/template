import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { JobHandler } from '#/jobs/types';

export const cleanStaleAuditLogs: JobHandler<void> = makeSingletonJob(async (ctx) => {
  const { db, log } = ctx;

  const retentionDays = process.env.AUDIT_LOG_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lt: cutoffDate } },
  });

  log(`Deleted ${result.count} audit logs older than ${retentionDays} days`);
});
