import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser, createWebhookEvent, createWebhookSubscription } from '@template/db/test';
import { cleanStaleWebhooks } from '#/jobs/handlers/cleanStaleWebhooks';
import type { WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

describe('cleanStaleWebhooks handler', () => {
  let ctx: WorkerContext;
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    ctx = createTestWorker({
      name: 'cleanStaleWebhooks',
      data: { id: 'cleanStaleWebhooks' },
    });
  });

  afterAll(async () => {
    await cleanupTouchedTables(ctx.db);
    await ctx.queue.redis.flushdb();
  });

  it('deletes events older than 90 days', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/webhook',
      model: 'CustomerRef',
    });

    // Create event older than 90 days
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    const { entity: oldEvent } = await createWebhookEvent(
      {
        status: 'success',
        action: 'create',
        resourceId: user.id,
        createdAt: oldDate,
      },
      context,
    );

    // Run handler
    await cleanStaleWebhooks(ctx);

    // Verify old event was deleted
    const deletedEvent = await ctx.db.webhookEvent.findUnique({
      where: { id: oldEvent.id },
    });
    expect(deletedEvent).toBeNull();
  });

  it('preserves events newer than 90 days', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/webhook2',
      model: 'CustomerRef',
    });

    // Create recent event (89 days old)
    const recentDate = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
    const { entity: recentEvent } = await createWebhookEvent(
      {
        status: 'success',
        action: 'create',
        resourceId: user.id,
        createdAt: recentDate,
      },
      context,
    );

    // Run handler
    await cleanStaleWebhooks(ctx);

    // Verify recent event still exists
    const existingEvent = await ctx.db.webhookEvent.findUnique({
      where: { id: recentEvent.id },
    });
    expect(existingEvent).not.toBeNull();
  });

  it('deletes multiple stale events in single run', async () => {
    const { context } = await createWebhookSubscription({
      ownerModel: 'User',
      userId: user.id,
      url: 'https://example.com/webhook3',
      model: 'CustomerRef',
    });

    // Create 3 old events
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const oldEvents = await Promise.all([
      createWebhookEvent({ status: 'success', action: 'create', resourceId: user.id, createdAt: oldDate }, context),
      createWebhookEvent({ status: 'success', action: 'update', resourceId: user.id, createdAt: oldDate }, context),
      createWebhookEvent({ status: 'success', action: 'delete', resourceId: user.id, createdAt: oldDate }, context),
    ]);

    // Run handler
    await cleanStaleWebhooks(ctx);

    // Verify all old events deleted
    const remainingEvents = await ctx.db.webhookEvent.findMany({
      where: {
        id: { in: oldEvents.map((e) => e.entity.id) },
      },
    });
    expect(remainingEvents.length).toBe(0);
  });

  it('handles empty database gracefully', async () => {
    // Delete all existing events
    await ctx.db.webhookEvent.deleteMany({});

    // Run handler on empty database - should not throw
    await cleanStaleWebhooks(ctx);

    // Verify no errors occurred (test passes if we reach here)
    expect(true).toBe(true);
  });
});
