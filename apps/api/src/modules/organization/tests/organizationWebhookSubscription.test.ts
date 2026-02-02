import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User, WebhookSubscription } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser, createWebhookSubscription, getNextSeq } from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json, post } from '#tests/utils/request';

describe('organization/webhookSubscriptions', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'member' });
    orgUser = entity;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('POST /organization/:id/webhookSubscriptions', () => {
    it('creates an org-owned webhook subscription', async () => {
      const seq = getNextSeq();
      const response = await fetch(
        post(`/api/v1/organization/${org.id}/webhookSubscriptions`, {
          model: 'CustomerRef',
          url: `https://example.com/org-webhook-${seq}`,
        }),
      );
      const { data } = await json<WebhookSubscription>(response);

      expect(response.status).toBe(201);
      expect(data.model).toBe('CustomerRef');
      expect(data.ownerModel).toBe('Organization');
      expect(data.organizationId).toBe(org.id);
      expect(data.isActive).toBe(true);
    });

    it('rejects viewer creating webhook', async () => {
      const { entity: viewerOrgUser, context } = await createOrganizationUser({ role: 'viewer' });
      const viewer = context.user;
      const viewerOrg = context.organization;

      const viewerHarness = createTestApp({
        mockUser: viewer,
        mockOrganizationUsers: [viewerOrgUser],
        mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
      });

      const seq = getNextSeq();
      const response = await viewerHarness.fetch(
        post(`/api/v1/organization/${viewerOrg.id}/webhookSubscriptions`, {
          model: 'CustomerRef',
          url: `https://example.com/viewer-webhook-${seq}`,
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /organization/:id/webhookSubscriptions', () => {
    it('returns org webhooks', async () => {
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'Organization',
        organizationId: org.id,
        url: `https://example.com/org-list-${seq}`,
      });

      const response = await fetch(get(`/api/v1/organization/${org.id}/webhookSubscriptions`));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((s) => s.url.includes(`org-list-${seq}`))).toBe(true);
    });

    it('excludes other org webhooks', async () => {
      const { context: otherContext } = await createOrganizationUser();
      const otherOrg = otherContext.organization;
      const seq = getNextSeq();
      await createWebhookSubscription({
        ownerModel: 'Organization',
        organizationId: otherOrg.id,
        url: `https://example.com/other-org-${seq}`,
      });

      const response = await fetch(get(`/api/v1/organization/${org.id}/webhookSubscriptions`));
      const { data } = await json<WebhookSubscription[]>(response);

      expect(response.status).toBe(200);
      expect(data.every((s) => s.organizationId === org.id)).toBe(true);
    });
  });
});
