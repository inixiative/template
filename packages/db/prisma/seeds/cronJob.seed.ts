/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses none
 */
import type { CronJob } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

// Cron schedules live in the DB (registerCronJobs.ts loads enabled rows on
// startup; the CronJob sync hook keeps BullMQ in step). Each seed run syncs a
// system row's name, jobId, handler and description from code, so a rename lands
// on deploy; the fields admins edit (pattern, enabled, payload, retry policy) are
// set on insert only.
//
// Multiple stale-data cleanups share one handler (cleanStaleData) — model +
// retentionDays + optional filters are baked into the payload. Add a row to
// schedule a new model's cleanup; no new handler needed.
export const cronJobSeeds: SeedFile<CronJob> = {
  model: 'cronJob',
  updateOmitFields: ['pattern', 'enabled', 'payload', 'maxAttempts', 'backoffMs'],
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
    {
      id: '01900000-0000-7000-8000-000000000003',
      name: 'sweepSegments',
      jobId: 'sweepSegments',
      description:
        'Nightly backstop: pause unevaluable dynamic segments and reconcile the rest in dependency order.',
      pattern: '0 4 * * *',
      enabled: true,
      handler: 'sweepSegments',
      payload: null,
      maxAttempts: 3,
      backoffMs: 5000,
    },
    {
      id: '01900000-0000-7000-8000-000000000004',
      name: 'cleanStaleFlows',
      jobId: 'cleanStaleFlows',
      description: 'Deletes flows nobody has advanced for 15 minutes.',
      pattern: '*/5 * * * *',
      enabled: true,
      handler: 'cleanStaleData',
      payload: { model: 'Flow', retentionDays: 15 / (24 * 60), dateField: 'updatedAt' },
      maxAttempts: 3,
      backoffMs: 5000,
    },
    {
      id: '01900000-0000-7000-8000-000000000005',
      name: 'coordinateRollingCaches',
      jobId: 'coordinateRollingCaches',
      description:
        'Rolling-cache root: enqueues the refresh branch of every cache whose timer is about to run out.',
      // Every minute: must match ROLLING_CACHE_TICK_SECONDS (packages/db/src/redis/rollingCacheTypes.ts).
      pattern: '* * * * *',
      enabled: true,
      handler: 'coordinateRollingCaches',
      payload: null,
      maxAttempts: 3,
      backoffMs: 5000,
    },
  ],
};
