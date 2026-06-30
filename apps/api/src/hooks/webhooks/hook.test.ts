import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { Integration, WebhookModel } from '@template/db/generated/client/enums';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import { cleanupTouchedTables, createUser, createWebhookSubscription } from '@template/db/test';
import { registerWebhookHook } from '#/hooks/webhooks/hook';
import * as enqueueModule from '#/jobs/enqueue';

registerWebhookHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

describe('webhook hook', () => {
  describe('with enabled models', () => {
    let userId: string;
    let enqueueSpy: ReturnType<typeof spyOn>;

    beforeAll(async () => {
      const { entity: user, context } = await createUser();
      userId = user.id;

      // Subscribe to CustomerRef - User changes route here via relatedModels
      await createWebhookSubscription({ model: WebhookModel.CustomerRef, url: 'https://example.com/webhook' }, context);
    });

    afterEach(() => {
      enqueueSpy?.mockRestore();
    });

    it('enqueues webhook job on create', async () => {
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
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-3', name: 'sendWebhook' });

      const user = await db.user.findUnique({ where: { id: userId } });
      await db.user.update({
        where: { id: userId },
        data: { name: user?.name },
      });

      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it('enqueues webhook job on delete', async () => {
      enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock-4', name: 'sendWebhook' });

      const { entity: tempUser } = await createUser();
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
});

describe('webhook hook — origin suppression', () => {
  let enqueueSpy: ReturnType<typeof spyOn>;
  let writeUserId: string;
  let sfSub: { id: string };
  let hsSub: { id: string };
  let plainSub: { id: string };

  beforeAll(async () => {
    // Spy before fixtures: createUser triggers the pre-existing subscription's webhook,
    // which in test mode runs sendWebhook for real.
    enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({ jobId: 'mock', name: 'sendWebhook' });

    const { entity: user, context } = await createUser();
    writeUserId = user.id;

    const { entity: sf } = await createWebhookSubscription(
      { model: WebhookModel.CustomerRef, url: 'https://example.com/webhook-sf', integration: Integration.salesforce },
      context,
    );
    const { entity: hs } = await createWebhookSubscription(
      { model: WebhookModel.CustomerRef, url: 'https://example.com/webhook-hs', integration: Integration.hubspot },
      context,
    );
    const { entity: plain } = await createWebhookSubscription(
      { model: WebhookModel.CustomerRef, url: 'https://example.com/webhook-plain' },
      context,
    );
    sfSub = sf;
    hsSub = hs;
    plainSub = plain;
  });

  afterAll(() => {
    enqueueSpy?.mockRestore();
  });

  const deliveredSubIds = () =>
    enqueueSpy.mock.calls.map(([, payload]) => (payload as { subscriptionId: string }).subscriptionId);

  it('skips the subscription whose integration is the write origin, delivers to the rest', async () => {
    enqueueSpy.mockClear();

    await auditActorContext.scope({ ...nullAuditActor, originIntegration: Integration.salesforce }, async () => {
      await db.user.update({ where: { id: writeUserId }, data: { name: 'Origin SF' } });
    });

    const delivered = deliveredSubIds();
    expect(delivered).toContain(hsSub.id);
    expect(delivered).toContain(plainSub.id);
    expect(delivered).not.toContain(sfSub.id);
  });

  it('delivers to every subscription when the write has no origin', async () => {
    enqueueSpy.mockClear();

    await db.user.update({ where: { id: writeUserId }, data: { name: 'No Origin' } });

    const delivered = deliveredSubIds();
    expect(delivered).toContain(sfSub.id);
    expect(delivered).toContain(hsSub.id);
    expect(delivered).toContain(plainSub.id);
  });
});
