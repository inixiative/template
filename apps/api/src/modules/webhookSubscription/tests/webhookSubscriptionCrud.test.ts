import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User, WebhookSubscription } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import { webhookSubscriptionRouter } from '#/modules/webhookSubscription';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, patch } from '#tests/utils/request';

describe('WebhookSubscription CRUD', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = entity;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/webhookSubscription', webhookSubscriptionRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('GET /webhookSubscription/:id', () => {
    it('reads own user webhook', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
      });

      const response = await fetch(get(`/api/v1/webhookSubscription/${sub.id}`));
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(200);
      expect(data.id).toBe(sub.id);
    });

    it('reads org webhook as member', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'Organization',
        organizationId: org.id,
      });

      const response = await fetch(get(`/api/v1/webhookSubscription/${sub.id}`));
      expect(response.status).toBe(200);
    });

    it('rejects reading other user webhook', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: otherUser.id,
      });

      const response = await fetch(get(`/api/v1/webhookSubscription/${sub.id}`));
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /webhookSubscription/:id', () => {
    it('updates own user webhook', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        isActive: true,
      });

      const response = await fetch(
        patch(`/api/v1/webhookSubscription/${sub.id}`, { isActive: false }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(200);
      expect(data.isActive).toBe(false);
    });

    it('reactivates webhook by default on update', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        isActive: false,
      });

      const response = await fetch(
        patch(`/api/v1/webhookSubscription/${sub.id}`, { url: 'https://new-url.com/webhook' }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(200);
      expect(data.isActive).toBe(true);
      expect(data.url).toBe('https://new-url.com/webhook');
    });

    it('keeps inactive when explicitly set', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
        isActive: false,
      });

      const response = await fetch(
        patch(`/api/v1/webhookSubscription/${sub.id}`, { isActive: false }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(200);
      expect(data.isActive).toBe(false);
    });

    it('rejects updating other user webhook', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: otherUser.id,
      });

      const response = await fetch(
        patch(`/api/v1/webhookSubscription/${sub.id}`, { isActive: false }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /webhookSubscription/:id', () => {
    it('deletes own user webhook', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: user.id,
      });

      const response = await fetch(del(`/api/v1/webhookSubscription/${sub.id}`));
      expect(response.status).toBe(204);

      const deleted = await db.webhookSubscription.findUnique({ where: { id: sub.id } });
      expect(deleted).toBeNull();
    });

    it('deletes org webhook as admin', async () => {
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'Organization',
        organizationId: org.id,
      });

      const response = await fetch(del(`/api/v1/webhookSubscription/${sub.id}`));
      expect(response.status).toBe(204);
    });

    it('rejects deleting other user webhook', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: sub } = await createWebhookSubscription({
        ownerModel: 'User',
        userId: otherUser.id,
      });

      const response = await fetch(del(`/api/v1/webhookSubscription/${sub.id}`));
      expect(response.status).toBe(403);
    });
  });
});
