import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import crypto from 'node:crypto';
import type { User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createIntegration,
  createIntegrationRecord,
  createUser,
  createWebhookEvent,
  createWebhookSubscription,
} from '@template/db/test';
import { setEnvOverride } from '@template/shared/utils';
import { sendWebhook } from '#/jobs/handlers/sendWebhook';
import { createTestApp } from '#tests/createTestApp';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const receivedWebhooks: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

// Event time is stamped once at the hook and carried through the job; tests pass it explicitly.
const eventTimestamp = new Date().toISOString();

describe('sendWebhook handler', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let testCounter = 0;

  const getUniqueUrl = (suffix = '') => `http://test-webhook.local/${++testCounter}${suffix}`;
  const mockLog = () => {};

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({ mockUser: user });
    db = harness.db;
  });

  beforeEach(() => {
    setEnvOverride('WEBHOOK_SIGNING_PRIVATE_KEY', privateKey);
    receivedWebhooks.length = 0;
    spyOn(globalThis, 'fetch').mockImplementation(((url: string, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      if (init?.headers) {
        const h = init.headers as Record<string, string>;
        for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = v;
      }
      receivedWebhooks.push({
        url,
        body: init?.body ? JSON.parse(init.body as string) : null,
        headers,
      });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }) as typeof fetch);
  });

  afterEach(() => {
    mock.restore();
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('successful delivery', () => {
    it('delivers webhook and creates success event', async () => {
      const testUrl = getUniqueUrl();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id, name: user.name },
          timestamp: eventTimestamp,
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('success');
      expect(event?.action).toBe('create');
      expect(event?.error).toBeNull();

      expect(receivedWebhooks.length).toBe(1);
      expect(receivedWebhooks[0].url).toBe(testUrl);
      // timestamp is carried through from the hook unchanged (passthrough, not re-stamped)
      expect(receivedWebhooks[0].body).toEqual({
        model: 'CustomerRef',
        action: 'create',
        payload: { id: user.id, name: user.name },
        timestamp: eventTimestamp,
      });

      expect(receivedWebhooks[0].headers['x-webhook-signature']).toBeDefined();
    });

    it('signature can be verified with public key', async () => {
      const testUrl = getUniqueUrl();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'update',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const received = receivedWebhooks[0];
      const signature = received.headers['x-webhook-signature'];
      const bodyJson = JSON.stringify(received.body);

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(bodyJson);
      verifier.end();

      const isValid = verifier.verify(publicKey, signature, 'base64');
      expect(isValid).toBe(true);
    });
  });

  describe('failed delivery', () => {
    it('creates error event on HTTP error response', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.resolve(
          new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }),
        )) as typeof fetch);

      const testUrl = getUniqueUrl('/error');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('unreachable');
      expect(event?.error).toContain('500');
    });

    it('blocks a redirect instead of following it (SSRF)', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.resolve(new Response('', { status: 302, statusText: 'Found' }))) as typeof fetch);

      const testUrl = getUniqueUrl('/redirect');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('error');
      expect(event?.error).toContain('Blocked redirect');
    });

    it('creates error event on network failure', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.reject(new Error('Connection refused'))) as typeof fetch);

      const testUrl = getUniqueUrl('/unreachable');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('unreachable');
      expect(event?.error).toContain('Connection refused');
    });

    it('skips inactive subscription', async () => {
      const testUrl = getUniqueUrl('/inactive');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
        isActive: false,
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).toBeNull();
      expect(receivedWebhooks.length).toBe(0);
    });

    it('skips non-existent subscription', async () => {
      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: 'non-existent-id',
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      expect(receivedWebhooks.length).toBe(0);
    });
  });

  describe('circuit breaker', () => {
    it('disables subscription after 5 consecutive failures', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.reject(new Error('Connection refused'))) as typeof fetch);

      const testUrl = getUniqueUrl('/circuit-break');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
        isActive: true,
      });

      for (let i = 0; i < 4; i++) {
        await createWebhookEvent(
          {
            status: 'unreachable',
            action: 'create',
            resourceId: user.id,
            error: 'Connection refused',
          },
          context,
        );
      }

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(false);
    });

    it('does not disable if a recent success exists', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.reject(new Error('Connection refused'))) as typeof fetch);

      const testUrl = getUniqueUrl('/no-circuit-break');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
        isActive: true,
      });

      for (let i = 0; i < 3; i++) {
        await createWebhookEvent(
          {
            status: 'unreachable',
            action: 'create',
            resourceId: user.id,
            error: 'Connection refused',
          },
          context,
        );
      }
      await createWebhookEvent(
        {
          status: 'success',
          action: 'create',
          resourceId: user.id,
        },
        context,
      );

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(true);
    });

    it('does not disable if fewer than 5 total events', async () => {
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.reject(new Error('Connection refused'))) as typeof fetch);

      const testUrl = getUniqueUrl('/few-events');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'CustomerRef',
        isActive: true,
      });

      for (let i = 0; i < 2; i++) {
        await createWebhookEvent(
          {
            status: 'unreachable',
            action: 'create',
            resourceId: user.id,
            error: 'Connection refused',
          },
          context,
        );
      }

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
          timestamp: eventTimestamp,
        },
      );

      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(true);
    });
  });

  describe('poisoned records', () => {
    const respondWith = (status: number, statusText: string) =>
      spyOn(globalThis, 'fetch').mockImplementation((() =>
        Promise.resolve(new Response(statusText, { status, statusText }))) as typeof fetch);
    const rejectDeliveries = () => respondWith(400, 'Bad Request');

    const rejection = (resourceId: string, httpStatus = 400) =>
      ({ status: 'error', resourceId, httpStatus, error: `HTTP ${httpStatus}` }) as const;

    const createRecordSubscription = async ({ withIntegration = true } = {}) => {
      const { entity: customer } = await createUser();
      const { entity: customerRef } = await createCustomerRef({
        customerModel: 'User',
        providerModel: 'User',
        customerUser: customer,
        providerUser: user,
      });
      const { entity: integration } = await createIntegration({ ownerModel: 'User', userId: user.id });
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: getUniqueUrl('/integration'),
        model: 'CustomerRef',
        integrationId: withIntegration ? integration.id : null,
      });
      receivedWebhooks.length = 0;
      return { sub, context, integration, customerRef };
    };

    const deliver = (subscriptionId: string, resourceId: string) =>
      sendWebhook(
        { db, log: mockLog },
        { subscriptionId, action: 'update', resourceId, data: { id: resourceId }, timestamp: eventTimestamp },
      );

    const findRecord = (integrationId: string, customerRefId: string) =>
      db.integrationRecord.findFirst({ where: { integrationId, customerRefId } });

    const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

    it('poisons the record on the second touch once another record delivered since its first rejection', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      const record = await findRecord(integration.id, customerRef.id);
      expect(record?.model).toBe('CustomerRef');
      expect(record?.poisonedAt).toBeInstanceOf(Date);
      expect(record?.poisonedReason).toBe('HTTP 400: Bad Request');
      const latest = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id, resourceId: customerRef.id },
        orderBy: { id: 'desc' },
      });
      expect(latest?.httpStatus).toBe(400);
    });

    it('never counts a rate-limited (429) delivery toward the streak', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id, 429), context);
      await createWebhookEvent(rejection(customerRef.id, 429), context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it('does not poison on a rate-limited (429) touch, even after enough rejections', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      respondWith(429, 'Too Many Requests');

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it('does not poison when the other record delivered before the streak began', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it('does not poison when nothing else delivered — that is the subscription circuit, not a dead record', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it('never counts unreachable events, and an unreachable blip mid-streak does not reset it', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'unreachable', resourceId: customerRef.id, error: 'HTTP 503' }, context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);
      expect(await findRecord(integration.id, customerRef.id)).toBeNull();

      await deliver(sub.id, customerRef.id);
      expect((await findRecord(integration.id, customerRef.id))?.poisonedAt).toBeInstanceOf(Date);
    });

    it("resets the streak on the record's own success", async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'success', resourceId: customerRef.id }, context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it("orders by id: a rejection in the same millisecond but before the record's success does not count", async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent({ ...rejection(customerRef.id), createdAt: at(1_000) }, context);
      await createWebhookEvent({ status: 'success', resourceId: customerRef.id, createdAt: at(1_000) }, context);
      await createWebhookEvent({ ...rejection(customerRef.id), createdAt: at(2_000) }, context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID(), createdAt: at(3_000) }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await findRecord(integration.id, customerRef.id)).toBeNull();
    });

    it("orders by id: a rejection in the same millisecond but after the record's success counts", async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent({ status: 'success', resourceId: customerRef.id, createdAt: at(1_000) }, context);
      await createWebhookEvent({ ...rejection(customerRef.id), createdAt: at(1_000) }, context);
      await createWebhookEvent({ ...rejection(customerRef.id), createdAt: at(2_000) }, context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID(), createdAt: at(3_000) }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect((await findRecord(integration.id, customerRef.id))?.poisonedAt).toBeInstanceOf(Date);
    });

    it('skips a poisoned record: no event, no request, while other records still deliver', async () => {
      const { sub, integration, customerRef } = await createRecordSubscription();
      await createIntegrationRecord({
        integration,
        customerRef,
        poisonedAt: new Date(),
        poisonedReason: 'HTTP 400: Bad Request',
      });

      await deliver(sub.id, customerRef.id);

      expect(await db.webhookEvent.count({ where: { webhookSubscriptionId: sub.id } })).toBe(0);
      expect(receivedWebhooks.length).toBe(0);

      const otherResourceId = crypto.randomUUID();
      await deliver(sub.id, otherResourceId);

      const delivered = await db.webhookEvent.findMany({ where: { webhookSubscriptionId: sub.id } });
      expect(delivered.map((event) => [event.resourceId, event.status])).toEqual([[otherResourceId, 'success']]);
      expect(receivedWebhooks.length).toBe(1);
    });

    it('never poisons on a subscription without an integration', async () => {
      const { sub, context, customerRef } = await createRecordSubscription({ withIntegration: false });
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      await deliver(sub.id, customerRef.id);

      expect(await db.integrationRecord.count({ where: { customerRefId: customerRef.id } })).toBe(0);
    });

    it('a record rejected five times in a row no longer disables a subscription that delivers other records', async () => {
      const { sub, context, integration, customerRef } = await createRecordSubscription();
      await createWebhookEvent(rejection(customerRef.id), context);
      await createWebhookEvent({ status: 'success', resourceId: crypto.randomUUID() }, context);
      rejectDeliveries();

      for (let i = 0; i < 5; i++) await deliver(sub.id, customerRef.id);

      expect((await findRecord(integration.id, customerRef.id))?.poisonedAt).toBeInstanceOf(Date);
      expect(
        await db.webhookEvent.count({ where: { webhookSubscriptionId: sub.id, resourceId: customerRef.id } }),
      ).toBe(3);
      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(true);
    });
  });
});
