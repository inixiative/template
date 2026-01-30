import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { User } from '@template/db';
import { cleanupTouchedTables, createUser, createWebhookEvent, createWebhookSubscription } from '@template/db/test';
import { sendWebhook } from '#/jobs/handlers/sendWebhook';
import { createTestApp } from '#tests/createTestApp';

// Generate test RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Track received webhook calls
const receivedWebhooks: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

// Mock fetch for testing
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

describe('sendWebhook handler', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let testCounter = 0;

  // Generate unique URL per test to avoid unique constraint
  const getUniqueUrl = (suffix = '') => `http://test-webhook.local/${++testCounter}${suffix}`;

  // Mock log function for worker context
  const mockLog = () => {};

  beforeAll(async () => {
    process.env.WEBHOOK_SIGNING_PRIVATE_KEY = privateKey;

    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({ mockUser: user });
    db = harness.db;
  });

  beforeEach(() => {
    receivedWebhooks.length = 0;

    // Mock fetch to intercept webhook calls
    mockFetch = mock((url: string, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      if (init?.headers) {
        const h = init.headers as Record<string, string>;
        for (const [k, v] of Object.entries(h)) {
          headers[k.toLowerCase()] = v;
        }
      }

      receivedWebhooks.push({
        url,
        body: init?.body ? JSON.parse(init.body as string) : null,
        headers,
      });

      // Return success by default
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
        model: 'User',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id, name: user.name },
        },
      );

      // Check event was created
      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('success');
      expect(event?.action).toBe('create');
      expect(event?.error).toBeNull();

      // Check webhook was sent
      expect(receivedWebhooks.length).toBe(1);
      expect(receivedWebhooks[0].url).toBe(testUrl);
      expect(receivedWebhooks[0].body).toEqual({
        model: 'User',
        action: 'create',
        payload: { id: user.id, name: user.name },
      });

      // Check signature header exists
      expect(receivedWebhooks[0].headers['x-webhook-signature']).toBeDefined();
    });

    it('signature can be verified with public key', async () => {
      const testUrl = getUniqueUrl();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'update',
          resourceId: user.id,
          data: { id: user.id },
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
      // Mock fetch to return 500 error
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })),
      ) as typeof fetch;

      const testUrl = getUniqueUrl('/error');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
        },
      );

      const event = await db.webhookEvent.findFirst({
        where: { webhookSubscriptionId: sub.id },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('unreachable');
      expect(event?.error).toContain('500');
    });

    it('creates error event on network failure', async () => {
      // Mock fetch to throw network error
      globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused'))) as typeof fetch;

      const testUrl = getUniqueUrl('/unreachable');
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
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
        model: 'User',
        isActive: false,
      });

      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
        },
      );

      // No event should be created
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
        },
      );

      // Should not throw, just log warning
      expect(receivedWebhooks.length).toBe(0);
    });
  });

  describe('circuit breaker', () => {
    it('disables subscription after 5 consecutive failures', async () => {
      // Mock fetch to always fail
      globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused'))) as typeof fetch;

      const testUrl = getUniqueUrl('/circuit-break');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
        isActive: true,
      });

      // Create 4 previous failed events - pass context so they link to the same subscription
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

      // Trigger the 5th failure
      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
        },
      );

      // Check subscription is now disabled
      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(false);
    });

    it('does not disable if a recent success exists', async () => {
      // Mock fetch to always fail
      globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused'))) as typeof fetch;

      const testUrl = getUniqueUrl('/no-circuit-break');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
        isActive: true,
      });

      // Create 3 failures, then 1 success - pass context so they link to the same subscription
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

      // Trigger another failure (this is only the 4th failure total, with 1 success in the middle)
      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
        },
      );

      // Subscription should still be active (success was within last 5)
      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(true);
    });

    it('does not disable if fewer than 5 total events', async () => {
      // Mock fetch to always fail
      globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused'))) as typeof fetch;

      const testUrl = getUniqueUrl('/few-events');
      const { entity: sub, context } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: testUrl,
        model: 'User',
        isActive: true,
      });

      // Only create 2 previous failures - pass context so they link to the same subscription
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

      // Trigger the 3rd failure
      await sendWebhook(
        { db, log: mockLog },
        {
          subscriptionId: sub.id,
          action: 'create',
          resourceId: user.id,
          data: { id: user.id },
        },
      );

      // Subscription should still be active (only 3 failures, need 5)
      const updated = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(updated?.isActive).toBe(true);
    });
  });
});
