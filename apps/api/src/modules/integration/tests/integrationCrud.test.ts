import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry } from '@template/db';
import type { Integration, Organization, User } from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganizationUser, createUser, getNextSeq } from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';

describe('Integration CRUD', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;

  beforeAll(async () => {
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

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  describe('POST create via owner submodels', () => {
    it('creates a user-owned integration via /me/integrations', async () => {
      const response = await fetch(post('/api/v1/me/integrations', { name: `Personal ${getNextSeq()}` }));
      const { data } = await json<Integration>(response);
      expect(response.status).toBe(201);
      expect(data.ownerModel).toBe('User');
      expect(data.userId).toBe(user.id);
    });

    it('creates an org-owned integration via /organization/:id/integrations as admin', async () => {
      const response = await fetch(
        post(`/api/v1/organization/${org.id}/integrations`, { name: `Salesforce ${getNextSeq()}` }),
      );
      const { data } = await json<Integration>(response);
      expect(response.status).toBe(201);
      expect(data.ownerModel).toBe('Organization');
      expect(data.organizationId).toBe(org.id);
    });
  });

  describe('GET /integration/:id', () => {
    it('reads own user integration', async () => {
      const integration = await db.integration.create({ data: { name: 'Own', ownerModel: 'User', userId: user.id } });
      const response = await fetch(get(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(200);
    });

    it('rejects reading another user integration (403)', async () => {
      const { entity: otherUser } = await createUser();
      const integration = await db.integration.create({
        data: { name: 'Foreign', ownerModel: 'User', userId: otherUser.id },
      });
      const response = await fetch(get(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /integration/:id', () => {
    it('updates own user integration', async () => {
      const integration = await db.integration.create({
        data: { name: 'Before', ownerModel: 'User', userId: user.id },
      });
      const response = await fetch(patch(`/api/v1/integration/${integration.id}`, { name: 'After' }));
      const { data } = await json<Integration>(response);
      expect(response.status).toBe(200);
      expect(data.name).toBe('After');
    });

    it('rejects updating another user integration (403)', async () => {
      const { entity: otherUser } = await createUser();
      const integration = await db.integration.create({
        data: { name: 'NoTouch', ownerModel: 'User', userId: otherUser.id },
      });
      const response = await fetch(patch(`/api/v1/integration/${integration.id}`, { name: 'Hacked' }));
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /integration/:id', () => {
    it('deletes own user integration', async () => {
      const integration = await db.integration.create({
        data: { name: 'Doomed', ownerModel: 'User', userId: user.id },
      });
      const response = await fetch(del(`/api/v1/integration/${integration.id}`));
      expect(response.status).toBe(204);
    });
  });

  describe('policy: read gates on read, mutate gates on admin', () => {
    it('an org member reads an org integration but cannot mutate it', async () => {
      const { entity: memberOrgUser, context: memberContext } = await createOrganizationUser({ role: Role.member });
      const integration = await db.integration.create({
        data: { name: 'OrgOwned', ownerModel: 'Organization', organizationId: memberContext.organization.id },
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
