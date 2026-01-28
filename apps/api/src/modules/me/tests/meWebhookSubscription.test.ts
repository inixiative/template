import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { User, WebhookSubscription } from '@template/db';
import { cleanupTouchedTables, createUser, createWebhookSubscription, getNextSeq } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

describe('me/webhookSubscriptions', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('POST /me/webhookSubscriptions', () => {
    it('creates a user-owned webhook subscription', async () => {
      const seq = getNextSeq();
      const response = await fetch(
        post('/api/v1/me/webhookSubscriptions', {
          model: 'User',
          url: `https://example.com/webhook-${seq}`,
        }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(201);
      expect(data.model).toBe('User');
      expect(data.ownerModel).toBe('User');
      expect(data.userId).toBe(user.id);
      expect(data.isActive).toBe(true);
    });

    it('rejects duplicate url for same model', async () => {
      const seq = getNextSeq();
      const url = `https://example.com/duplicate-${seq}`;
      await fetch(post('/api/v1/me/webhookSubscriptions', { model: 'User', url }));

      const response = await fetch(post('/api/v1/me/webhookSubscriptions', { model: 'User', url }));
      expect(response.status).toBe(409);
    });
  });

  describe('GET /me/webhookSubscriptions', () => {
    it('returns user webhooks', async () => {
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        url: `https://example.com/list-${seq}`,
      });

      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((s) => s.url.includes(`list-${seq}`))).toBe(true);
    });

    it('excludes other user webhooks', async () => {
      const { entity: otherUser } = await createUser();
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'User',
        userId: otherUser.id,
        url: `https://example.com/other-${seq}`,
      });

      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.userId === user.id)).toBe(true);
    });

    it('excludes org-owned webhooks', async () => {
      const response = await fetch(get('/api/v1/me/webhookSubscriptions'));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.ownerModel === 'User')).toBe(true);
    });
  });
});
