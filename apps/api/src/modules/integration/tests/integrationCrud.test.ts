import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Integration, Organization, User } from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganizationUser,
  createUser,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch, post } from '#tests/utils/request';

describe('Integration CRUD', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;

  beforeEach(async () => {
    const { entity: orgUser, context } = await createOrganizationUser({ role: Role.admin });
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [
        (app) => app.route('/api/v1/integration', integrationRouter),
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  describe('POST create via owner submodels', () => {
    it('creates a user-owned integration via /me/integrations', async () => {
      const response = await fetch(
        post('/api/v1/me/integrations', {
          name: `Personal ${nextFactorySequenceNumber()}`,
          role: 'viewer',
        }),
      );
      const { data } = await parseSuccessBody<Integration>(response);
      expect(response.status).toBe(201);
      expect(data.ownerModel).toBe('User');
      expect(data.userId).toBe(user.id);
    });

    it('creates an org-owned integration via /organization/:id/integrations as admin', async () => {
      const response = await fetch(
        post(`/api/v1/organization/${org.id}/integrations`, {
          name: `Salesforce ${nextFactorySequenceNumber()}`,
          role: 'viewer',
        }),
      );
      const { data } = await parseSuccessBody<Integration>(response);
      expect(response.status).toBe(201);
      expect(data.ownerModel).toBe('Organization');
      expect(data.organizationId).toBe(org.id);
    });
  });

  describe('GET /integration/:id', () => {
    it('reads own user integration', async () => {
      const { entity: integration } = await createIntegration({
        name: 'Own',
        role: 'viewer',
        ownerModel: 'User',
        userId: user.id,
      });
      const response = await fetch(get(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(200);
    });

    it('rejects reading another user integration (403)', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: integration } = await createIntegration({
        name: 'Foreign',
        role: 'viewer',
        ownerModel: 'User',
        userId: otherUser.id,
      });
      const response = await fetch(get(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /integration/:id', () => {
    it('updates own user integration', async () => {
      const { entity: integration } = await createIntegration({
        name: 'Before',
        role: 'viewer',
        ownerModel: 'User',
        userId: user.id,
      });
      const response = await fetch(
        patch(`/api/v1/integration/${integration.id}`, { name: 'After' }),
      );
      const { data } = await parseSuccessBody<Integration>(response);
      expect(response.status).toBe(200);
      expect(data.name).toBe('After');
    });

    it('rejects updating another user integration (403)', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: integration } = await createIntegration({
        name: 'NoTouch',
        role: 'viewer',
        ownerModel: 'User',
        userId: otherUser.id,
      });
      const response = await fetch(
        patch(`/api/v1/integration/${integration.id}`, { name: 'Hacked' }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('configuration', () => {
    const cloudId = '01234567-89ab-4cde-8f01-23456789abcd';

    it('stores a configuration that fits the provider', async () => {
      const response = await fetch(
        post('/api/v1/me/integrations', {
          name: `Jira ${nextFactorySequenceNumber()}`,
          provider: 'jira',
          role: 'viewer',
          configuration: { cloudId },
        }),
      );
      const { data } = await parseSuccessBody<Integration>(response);
      expect(response.status).toBe(201);
      expect(data.configuration).toEqual({ cloudId });
    });

    it('refuses a configuration that does not fit the provider (422)', async () => {
      const response = await fetch(
        post('/api/v1/me/integrations', {
          name: `Jira ${nextFactorySequenceNumber()}`,
          provider: 'jira',
          role: 'viewer',
          configuration: { url: 'https://example.com' },
        }),
      );
      expect(response.status).toBe(422);
    });

    it('refuses a configuration on a provider-less integration (422)', async () => {
      const response = await fetch(
        post('/api/v1/me/integrations', {
          name: `Plain ${nextFactorySequenceNumber()}`,
          role: 'viewer',
          configuration: { cloudId },
        }),
      );
      expect(response.status).toBe(422);
    });

    it('checks an update against the stored provider (422)', async () => {
      const { entity: integration } = await createIntegration({
        name: 'Atlassian',
        provider: 'confluence',
        role: 'viewer',
        ownerModel: 'User',
        userId: user.id,
      });
      const refused = await fetch(
        patch(`/api/v1/integration/${integration.id}`, { configuration: { cloudId: 'nope' } }),
      );
      expect(refused.status).toBe(422);
      const accepted = await fetch(
        patch(`/api/v1/integration/${integration.id}`, { configuration: { cloudId } }),
      );
      const { data } = await parseSuccessBody<Integration>(accepted);
      expect(accepted.status).toBe(200);
      expect(data.configuration).toEqual({ cloudId });
    });
  });

  describe('DELETE /integration/:id', () => {
    it('tombstones own user integration — row survives, read 404s', async () => {
      const { entity: integration } = await createIntegration({
        name: 'Doomed',
        role: 'viewer',
        ownerModel: 'User',
        userId: user.id,
      });
      const response = await fetch(del(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(204);

      const row = await db.integration.findFirst({
        where: { id: integration.id, deletedAt: { not: null } },
      });
      expect(row).not.toBeNull();

      const readResponse = await fetch(get(`/api/v1/integration/${integration.id}`));
      expect(readResponse.status).toBe(404);
    });
  });

  describe('policy: read gates on read, mutate gates on admin', () => {
    it('an org member reads an org integration but cannot mutate it', async () => {
      const { entity: memberOrgUser, context: memberContext } = await createOrganizationUser({
        role: Role.member,
      });
      const { entity: integration } = await createIntegration({
        name: 'OrgOwned',
        role: 'viewer',
        ownerModel: 'Organization',
        organizationId: memberContext.organization.id,
      });

      const memberApp = createTestApp({
        mockUser: memberContext.user,
        mockOrganizationUsers: [memberOrgUser],
        mount: [(app) => app.route('/api/v1/integration', integrationRouter)],
      });

      const readResponse = await memberApp.fetch(get(`/api/v1/integration/${integration.id}`));
      expect(readResponse.status).toBe(200);

      const mutateResponse = await memberApp.fetch(
        patch(`/api/v1/integration/${integration.id}`, { name: 'MemberEdit' }),
      );
      expect(mutateResponse.status).toBe(403);
    });
  });
});
