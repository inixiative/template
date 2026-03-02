import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, Space, SpaceUser, User, WebhookSubscription } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createSpace, createWebhookSubscription, getNextSeq } from '@template/db/test';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

describe('space/webhookSubscriptions', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;
  let space: Space;
  let spaceUser: SpaceUser;

  beforeAll(async () => {
    const { entity: ou, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = ou;
    user = context.user;
    org = context.organization;

    const { entity: s } = await createSpace({}, { organization: org });
    space = s;

    spaceUser = await db.spaceUser.create({
      data: {
        role: 'admin',
        organizationId: org.id,
        spaceId: space.id,
        userId: user.id,
      },
    });

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mockSpaceUsers: [spaceUser],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  describe('POST /space/:id/webhookSubscriptions', () => {
    it('creates a space-owned webhook subscription', async () => {
      const seq = getNextSeq();
      const response = await fetch(
        post(`/api/v1/space/${space.id}/webhookSubscriptions`, {
          model: 'CustomerRef',
          url: `https://example.com/space-webhook-${seq}`,
        }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(201);
      expect(data.ownerModel).toBe('Space');
      expect(data.spaceId).toBe(space.id);
      expect(data.organizationId).toBeNull();
    });

    it('allows member creating webhook', async () => {
      const { entity: memberOrgUser, context: memberContext } = await createOrganizationUser(
        { role: 'member' },
        { organization: org },
      );
      const memberSpaceUser = await db.spaceUser.create({
        data: {
          role: 'member',
          organizationId: org.id,
          spaceId: space.id,
          userId: memberContext.user.id,
        },
      });

      const memberHarness = createTestApp({
        mockUser: memberContext.user,
        mockOrganizationUsers: [memberOrgUser],
        mockSpaceUsers: [memberSpaceUser],
        mount: [(app) => app.route('/api/v1/space', spaceRouter)],
      });

      const seq = getNextSeq();
      const response = await memberHarness.fetch(
        post(`/api/v1/space/${space.id}/webhookSubscriptions`, {
          model: 'CustomerRef',
          url: `https://example.com/space-member-webhook-${seq}`,
        }),
      );

      expect(response.status).toBe(201);
      const { data } = await json<WebhookSubscription>(response);
      expect(data.ownerModel).toBe('Space');
      expect(data.spaceId).toBe(space.id);
      expect(data.organizationId).toBeNull();
    });
  });

  describe('GET /space/:id/webhookSubscriptions', () => {
    it('returns space webhooks', async () => {
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'Space',
        spaceId: space.id,
        url: `https://example.com/space-list-${seq}`,
      });

      const response = await fetch(get(`/api/v1/space/${space.id}/webhookSubscriptions`));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((s) => s.url.includes(`space-list-${seq}`))).toBe(true);
      expect(data.every((s) => s.ownerModel === 'Space')).toBe(true);
    });

    it('excludes other space webhooks', async () => {
      const { entity: otherSpace } = await createSpace({}, { organization: org });
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'Space',
        spaceId: otherSpace.id,
        url: `https://example.com/other-space-${seq}`,
      });

      const response = await fetch(get(`/api/v1/space/${space.id}/webhookSubscriptions`));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.spaceId === space.id)).toBe(true);
    });
  });
});
