import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';
import { WebhookModel, db } from '@template/db';
import { cleanupTouchedTables, createUser, createWebhookSubscription } from '@template/db/test';
import * as enqueueModule from '#/jobs/enqueue';
import { registerWebhookHook } from './hook';
import { resetWebhookEnabledModels, setWebhookEnabledModels } from './utils';

registerWebhookHook();

/**
 * NOTE: Requires NODE_ENV=test to load .env.test (for REDIS_URL and webhook signing keys).
 * Run with: NODE_ENV=test bun test src/hooks/webhooks/hook.test.ts
 *
 * Upsert behavior: action is 'create' if previous is null, 'update' otherwise.
 * This is determined by checking if mutationLifeCycle found an existing record.
 */

afterAll(async () => {
  await cleanupTouchedTables(db);
});

afterEach(() => {
  resetWebhookEnabledModels();
});

describe('webhook hook', () => {
  describe('with enabled models', () => {
    let userId: string;
    let subscriptionId: string;
    let enqueueSpy: ReturnType<typeof spyOn>;

    beforeAll(async () => {
      setWebhookEnabledModels([WebhookModel.User]);

      const { entity: user, context } = await createUser();
      userId = user.id;

      const { entity: subscription } = await createWebhookSubscription(
        { model: WebhookModel.User, url: 'https://example.com/webhook' },
        context,
      );
      subscriptionId = subscription.id;
    });

    afterEach(() => {
      enqueueSpy?.mockRestore();
    });

    it('enqueues webhook job on create', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-1', name: 'sendWebhook' });

      const user = await db.user.create({
        data: { email: `webhook-test-create-${Date.now()}@example.com` },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        'sendWebhook',
        expect.objectContaining({
          action: 'create',
          resourceId: user.id,
        }),
      );
    });

    it('enqueues webhook job on update with relevant changes', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-2', name: 'sendWebhook' });

      await db.user.update({
        where: { id: userId },
        data: { name: 'Updated Name' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        'sendWebhook',
        expect.objectContaining({
          action: 'update',
          resourceId: userId,
        }),
      );
    });

    it('skips webhook for no-op updates (only updatedAt changed)', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-3', name: 'sendWebhook' });

      // Touch the record without changing relevant fields
      const user = await db.user.findUnique({ where: { id: userId } });
      await db.user.update({
        where: { id: userId },
        data: { name: user?.name },
      });

      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it('enqueues webhook job on delete', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-4', name: 'sendWebhook' });

      const { entity: tempUser } = await createUser();

      // Clear spy from create
      enqueueSpy.mockClear();

      await db.user.delete({ where: { id: tempUser.id } });

      expect(enqueueSpy).toHaveBeenCalledWith(
        'sendWebhook',
        expect.objectContaining({
          action: 'delete',
          resourceId: tempUser.id,
        }),
      );
    });

    it('enqueues webhook job on upsert (update path)', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-5', name: 'sendWebhook' });

      await db.user.upsert({
        where: { id: userId },
        create: { email: `upsert-create-${Date.now()}@example.com` },
        update: { name: 'Upserted Name' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        'sendWebhook',
        expect.objectContaining({
          action: 'update',
          resourceId: userId,
        }),
      );
    });

    it('enqueues webhook job on upsert (create path)', async () => {
      setWebhookEnabledModels([WebhookModel.User]);
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-6', name: 'sendWebhook' });

      const newEmail = `upsert-new-${Date.now()}@example.com`;
      const result = await db.user.upsert({
        where: { email: newEmail },
        create: { email: newEmail, name: 'New Upsert User' },
        update: { name: 'Would Not Use' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        'sendWebhook',
        expect.objectContaining({
          action: 'create',
          resourceId: result.id,
        }),
      );
    });
  });

  describe('with disabled models', () => {
    it('does not enqueue jobs for disabled models', async () => {
      resetWebhookEnabledModels(); // Ensure empty
      const enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-5', name: 'sendWebhook' });

      await db.user.create({
        data: { email: `webhook-disabled-${Date.now()}@example.com` },
      });

      expect(enqueueSpy).not.toHaveBeenCalled();
      enqueueSpy.mockRestore();
    });
  });
});
