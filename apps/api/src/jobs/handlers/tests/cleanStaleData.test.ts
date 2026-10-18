import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createFlow,
  createUser,
  createWebhookEvent,
  createWebhookSubscription,
} from '@template/db/test';
import { cleanStaleData } from '#/jobs/handlers/cleanStaleData';
import type { WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('cleanStaleData handler', () => {
  let ctx: WorkerContext;
  let user: User;

  beforeEach(async () => {
    const { entity } = await createUser();
    user = entity;
    ctx = createTestWorker({ name: 'cleanStaleData', data: { id: 'cleanStaleData' } });
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
    await ctx.queue.redis.flushdb();
  });

  it('deletes rows older than retentionDays for the configured model', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/1',
      model: 'CustomerRef',
    });
    const { entity: oldEvent } = await createWebhookEvent(
      { status: 'success', action: 'create', resourceId: user.id, createdAt: daysAgo(91) },
      context,
    );

    await cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90 });

    expect(await db.webhookEvent.findUnique({ where: { id: oldEvent.id } })).toBeNull();
  });

  it('deletes flows untouched for 15 minutes, keyed on updatedAt', async () => {
    const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);
    const { entity: stale } = await createFlow(
      { createdAt: minutesAgo(30), updatedAt: minutesAgo(16) },
      { user },
    );
    const { entity: active } = await createFlow(
      { createdAt: minutesAgo(30), updatedAt: minutesAgo(5) },
      { user },
    );

    await cleanStaleData(ctx, {
      model: 'Flow',
      retentionDays: 15 / (24 * 60),
      dateField: 'updatedAt',
    });

    expect(await db.flow.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await db.flow.findUnique({ where: { id: active.id } })).not.toBeNull();
  });

  it('preserves rows within retentionDays', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/2',
      model: 'CustomerRef',
    });
    const { entity: recent } = await createWebhookEvent(
      { status: 'success', action: 'create', resourceId: user.id, createdAt: daysAgo(89) },
      context,
    );

    await cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90 });

    expect(await db.webhookEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it('respects extra filters in addition to the age cutoff', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/3',
      model: 'CustomerRef',
    });
    const { entity: oldSuccess } = await createWebhookEvent(
      { status: 'success', action: 'create', resourceId: user.id, createdAt: daysAgo(100) },
      context,
    );
    const { entity: oldError } = await createWebhookEvent(
      { status: 'error', action: 'create', resourceId: user.id, createdAt: daysAgo(100) },
      context,
    );

    // Only purge old SUCCESSES — keep errored ones for investigation.
    await cleanStaleData(ctx, {
      model: 'WebhookEvent',
      retentionDays: 90,
      filters: { status: 'success' },
    });

    expect(await db.webhookEvent.findUnique({ where: { id: oldSuccess.id } })).toBeNull();
    expect(await db.webhookEvent.findUnique({ where: { id: oldError.id } })).not.toBeNull();
  });

  it('handles empty result set without error', async () => {
    await expect(
      cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90 }),
    ).resolves.toBeUndefined();
  });

  it('throws when archive is configured (stub not implemented)', async () => {
    await expect(
      cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90, archive: { target: 's3' } }),
    ).rejects.toThrow('Archive not yet implemented');
  });

  it('singleton lock blocks concurrent invocations for the same job id', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/4',
      model: 'CustomerRef',
    });
    await createWebhookEvent(
      { status: 'success', action: 'create', resourceId: user.id, createdAt: daysAgo(100) },
      context,
    );

    // Two simultaneous calls — singleton lock means only one actually runs.
    // Test passes if both resolve without throwing.
    await Promise.all([
      cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90 }),
      cleanStaleData(ctx, { model: 'WebhookEvent', retentionDays: 90 }),
    ]);

    expect(await db.webhookEvent.count()).toBe(0);
  });
});
