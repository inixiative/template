import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { User, WebhookSubscription } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createUser,
  createWebhookSubscription,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, parseSuccessBody, post } from '#tests/utils/request';

describe('me/webhookSubscriptions', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeEach(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  beforeEach(() => {
    spyOn(globalThis, 'fetch').mockImplementation(
      Object.assign(
        () => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        {
          preconnect: globalThis.fetch.preconnect,
        },
      ),
    );
  });

  afterEach(() => {
    mock.restore();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('POST /me/webhookSubscriptions', () => {
    it('creates a user-owned webhook subscription', async () => {
      const seq = nextFactorySequenceNumber();
      const response = await fetch(
        post('/api/v1/me/webhookSubscriptions', {
          resourceModel: 'CustomerRelationship',
          url: `https://example.com/webhook-${seq}`,
        }),
      );
      const { data } = await parseSuccessBody<WebhookSubscription>(response);

      expect(response.status).toBe(201);
      expect(data.resourceModel).toBe('CustomerRelationship');
      expect(data.ownerModel).toBe('User');
      expect(data.userId).toBe(user.id);
      expect(data.isActive).toBe(true);
    });

    it('rejects duplicate url for same model', async () => {
      const seq = nextFactorySequenceNumber();
      const url = `https://example.com/duplicate-${seq}`;
      await fetch(
        post('/api/v1/me/webhookSubscriptions', { resourceModel: 'CustomerRelationship', url }),
      );

      const response = await fetch(
        post('/api/v1/me/webhookSubscriptions', { resourceModel: 'CustomerRelationship', url }),
      );
      expect(response.status).toBe(409);
    });
  });

  describe('GET /me/webhookSubscriptions', () => {
    it('returns user webhooks', async () => {
      const seq = nextFactorySequenceNumber();
      await createWebhookSubscription({
        resourceModel: 'CustomerRelationship',
        ownerModel: 'User',
        userId: user.id,
        url: `https://example.com/list-${seq}`,
      });

      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await parseSuccessBody<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((s) => s.url.includes(`list-${seq}`))).toBe(true);
    });

    it('excludes other user webhooks', async () => {
      const { entity: otherUser } = await createUser();
      const seq = nextFactorySequenceNumber();
      await createWebhookSubscription({
        resourceModel: 'CustomerRelationship',
        ownerModel: 'User',
        userId: otherUser.id,
        url: `https://example.com/other-${seq}`,
      });

      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await parseSuccessBody<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.userId === user.id)).toBe(true);
    });

    it('excludes org-owned webhooks', async () => {
      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await parseSuccessBody<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.ownerModel === 'User')).toBe(true);
    });
  });
});
