/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 */
import type { CronJob } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

// Cron schedules live in the DB (registerCronJobs.ts loads enabled rows on
// startup; the CronJob sync hook keeps BullMQ in step on live updates). Seed
// inserts each row once with `createOnly: true` — admin can later edit pattern
// or payload via the admin UI without the seed clobbering changes.
//
// Multiple stale-data cleanups share one handler (cleanStaleData) — model +
// retentionDays + optional filters are baked into the payload. Add a row to
// schedule a new model's cleanup; no new handler needed.
export const cronJobSeeds: SeedFile<CronJob> = {
  model: 'cronJob',
  createOnly: true,
  records: [
    {
      id: '01900000-0000-7000-8000-000000000001',
      name: 'cleanStaleAuditLogs',
      jobId: 'cleanStaleAuditLogs',
      description: 'Daily cleanup of AuditLog rows older than retentionDays.',
      pattern: '0 3 * * *', // 03:00 UTC daily
      enabled: true,
      handler: 'cleanStaleData',
      payload: { model: 'AuditLog', retentionDays: 365 },
      maxAttempts: 3,
      backoffMs: 5000,
    },
    {
      id: '01900000-0000-7000-8000-000000000002',
      name: 'cleanStaleWebhookEvents',
      jobId: 'cleanStaleWebhookEvents',
      description: 'Daily cleanup of WebhookEvent rows older than retentionDays.',
      pattern: '0 3 * * *',
      enabled: true,
      handler: 'cleanStaleData',
      payload: { model: 'WebhookEvent', retentionDays: 90 },
      maxAttempts: 3,
      backoffMs: 5000,
    },
  ],
};
