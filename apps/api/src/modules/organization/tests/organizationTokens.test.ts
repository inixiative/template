import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import { type Organization, type OrganizationUser, TokenOwnerModel, type User } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';
import { organizationReadManyTokenRoute } from '#/modules/organization/routes/organizationReadManyToken';
import { createTestApp } from '#tests/createTestApp';
import { get, post } from '#tests/utils/request';

type CreateTokenResponse = { data: z.infer<typeof organizationCreateTokenRoute.responseSchema> };
type ReadManyTokensResponse = {
  data: z.infer<typeof organizationReadManyTokenRoute.responseSchema>[];
  pagination: { total: number; page: number; pageSize: number };
};

describe('Organizations Tokens', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { entity: o } = await createOrganization();
    org = o;

    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { User: user, Organization: org });
    orgUser = ou;

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

  describe('POST /api/v1/organization/:id/tokens', () => {
    it('creates a token and returns raw key', async () => {
      const response = await fetch(post(`/api/v1/organization/${org.id}/tokens`, { name: 'Org API Key', role: 'admin' }));
      expect(response.status).toBe(201);

      const { data } = (await response.json()) as CreateTokenResponse;
      expect(data.name).toBe('Org API Key');
      expect(data.ownerModel).toBe('Organization');
      expect(data.organizationId).toBe(org.id);
      expect(data.key).toBeDefined();
      expect(data.key!.length).toBeGreaterThan(20);
    });
  });

  describe('GET /api/v1/organization/:id/tokens', () => {
    it('returns organization tokens without keyHash', async () => {
      await createToken({ name: 'Listed Token', ownerModel: TokenOwnerModel.Organization }, { Organization: org });

      const response = await fetch(get(`/api/v1/organization/${org.id}/tokens`));
      expect(response.status).toBe(200);

      const { data } = (await response.json()) as ReadManyTokensResponse;
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect((data[0] as Record<string, unknown>).keyHash).toBeUndefined();
      expect(data[0].keyPrefix).toBeDefined();
    });
  });
});
