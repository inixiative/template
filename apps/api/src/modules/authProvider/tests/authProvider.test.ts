import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { AuthProvider, Organization, OrganizationUser, User } from '@template/db';
import { AuthProviderType, PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createAuthProvider, createOrganization, createOrganizationUser, createUser } from '@template/db/test';
import { authProviderRouter, adminAuthProviderRouter } from '#/modules/authProvider';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';


describe('AuthProvider Endpoints', () => {
  let superadminFetch: ReturnType<typeof createTestApp>['fetch'];
  let userFetch: ReturnType<typeof createTestApp>['fetch'];
  let publicFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: sa } = await createUser({ platformRole: PlatformRole.superadmin });
    superadmin = sa;

    const { entity, context } = await createOrganizationUser({ role: 'owner' });
    orgUser = entity;
    user = context.user;
    org = context.organization;

    const superadminHarness = createTestApp({
      mockUser: superadmin,
      mount: [
        (app) => app.route('/api/admin/authProvider', adminAuthProviderRouter),
        (app) => app.route('/api/v1/authProvider', authProviderRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    superadminFetch = superadminHarness.fetch;
    db = superadminHarness.db;

    const userHarness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [
        (app) => app.route('/api/v1/authProvider', authProviderRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    userFetch = userHarness.fetch;

    const publicHarness = createTestApp({
      mount: [(app) => app.route('/api/v1/authProvider', authProviderRouter)],
    });
    publicFetch = publicHarness.fetch;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('GET /api/v1/authProvider (public)', () => {
    it('returns platform providers without auth', async () => {
      const response = await publicFetch(get('/api/v1/authProvider'));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns only enabled platform providers', async () => {
      const response = await publicFetch(get('/api/v1/authProvider'));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      data.forEach((provider) => {
        expect(provider.enabled).toBe(true);
      });
    });

    it('returns providers with required fields', async () => {
      const response = await publicFetch(get('/api/v1/authProvider'));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      data.forEach((provider) => {
        expect(provider).toHaveProperty('type');
        expect(provider).toHaveProperty('provider');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('enabled');
        expect(['oauth', 'saml']).toContain(provider.type);
      });
    });
  });

  describe('GET /api/admin/authProvider', () => {
    it('returns all auth providers for superadmin', async () => {
      await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'test-oauth',
        name: 'Test OAuth',
        config: { clientId: 'test-client' },
      }, { organization: org });

      const response = await superadminFetch(get('/api/admin/authProvider?page=1&pageSize=10'));
      const { data, pagination } = await json(response);

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(pagination.page).toBe(1);
    });

    it('filters by organizationId', async () => {
      const { entity: otherOrg } = await createOrganization();

      await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'org-provider',
        name: 'Org Provider',
      }, { organization: org });

      await createAuthProvider({
        type: AuthProviderType.SAML,
        provider: 'other-provider',
        name: 'Other Provider',
      }, { organization: otherOrg });

      const response = await superadminFetch(get(`/api/admin/authProvider?organizationId=${org.id}`));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.every((p) => p.organizationId === org.id)).toBe(true);
    });

    it('omits encrypted fields', async () => {
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'secure-provider',
        name: 'Secure Provider',
        config: { clientId: 'id' },
      }, { organization: org });

      const response = await superadminFetch(get('/api/admin/authProvider'));
      const { data, pagination } = await json(response);

      const found = data.find((p) => p.id === provider.id);
      expect(found).toBeDefined();
      expect(found).not.toHaveProperty('encryptedSecrets');
      expect(found).not.toHaveProperty('encryptedSecretsMetadata');
      expect(found).not.toHaveProperty('encryptedSecretsKeyVersion');
    });
  });

  describe('GET /api/v1/organization/:id/authProvider', () => {
    it('returns platform and org providers', async () => {
      await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'custom-oauth',
        name: 'Custom OAuth',
        config: { clientId: 'custom-client' },
      }, { organization: org });

      const response = await userFetch(get(`/api/v1/organization/${org.id}/authProvider`));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('platform');
      expect(data).toHaveProperty('organization');
      expect(Array.isArray(data.platform)).toBe(true);
      expect(Array.isArray(data.organization)).toBe(true);
      expect(data.organization.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty org array for org with no custom providers', async () => {
      const { entity: newOrgUser, context } = await createOrganizationUser({ role: 'owner' }, { user });

      const newUserFetch = createTestApp({
        mockUser: user,
        mockOrganizationUsers: [newOrgUser],
        mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
      }).fetch;

      const response = await newUserFetch(get(`/api/v1/organization/${context.organization.id}/authProvider`));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.organization).toEqual([]);
    });

    it('returns config without encrypted secrets', async () => {
      await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'google',
        name: 'Google OAuth',
        config: {
          clientId: 'oauth-client-id',
          domains: ['example.com'],
        },
      }, { organization: org });

      const response = await userFetch(get(`/api/v1/organization/${org.id}/authProvider`));
      const { data } = await json(response);

      expect(response.status).toBe(200);
      const provider = data.organization.find(p => p.provider === 'google');
      expect(provider).toBeDefined();
      expect(provider!.config).toEqual({
        clientId: 'oauth-client-id',
        domains: ['example.com'],
      });
      expect(provider).not.toHaveProperty('encryptedSecrets');
    });
  });

  describe('POST /api/v1/organization/:id/authProviders', () => {
    it('creates auth provider with encrypted secrets', async () => {
      const response = await userFetch(
        post(`/api/v1/organization/${org.id}/authProviders`, {
          type: 'OAUTH',
          provider: 'github',
          name: 'GitHub',
          config: {
            clientId: 'github-client',
          },
          secrets: {
            clientSecret: 'github-secret',
          },
        }),
      );
      const { data } = await json(response);

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.organizationId).toBe(org.id);
      expect(data.type).toBe('OAUTH');
      expect(data.provider).toBe('github');

      const raw = await db.authProvider.findUnique({ where: { id: data.id } });
      expect(raw?.encryptedSecrets).toBeDefined();
      expect(typeof raw?.encryptedSecrets).toBe('string');
    });

    it('sets default enabled to true', async () => {
      const response = await userFetch(
        post(`/api/v1/organization/${org.id}/authProviders`, {
          type: 'SAML',
          provider: 'okta',
          name: 'Okta SAML',
          config: { metadataUrl: 'https://okta.com/metadata' },
          secrets: { signingCert: 'test-cert' },
        }),
      );
      const { data } = await json(response);

      expect(response.status).toBe(201);
      expect(data.enabled).toBe(true);
    });

    it('omits encrypted fields in response', async () => {
      const response = await userFetch(
        post(`/api/v1/organization/${org.id}/authProviders`, {
          type: 'OAUTH',
          provider: 'microsoft',
          name: 'Microsoft',
          config: { clientId: 'ms-id' },
          secrets: { clientSecret: 'ms-secret' },
        }),
      );
      const { data } = await json(response);

      expect(response.status).toBe(201);
      expect(data).not.toHaveProperty('encryptedSecrets');
      expect(data).not.toHaveProperty('encryptedSecretsMetadata');
      expect(data).not.toHaveProperty('encryptedSecretsKeyVersion');
    });
  });

  describe('PATCH /api/v1/authProvider/:id', () => {
    it('updates auth provider and re-encrypts secrets', async () => {
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'google-workspace',
        name: 'Google Workspace',
        config: { clientId: 'old-id' },
      }, { organization: org });

      const response = await userFetch(
        patch(`/api/v1/authProvider/${provider.id}`, {
          name: 'Google OAuth Updated',
          config: { clientId: 'new-id' },
          secrets: { clientSecret: 'new-secret' },
        }),
      );
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.name).toBe('Google OAuth Updated');

      const raw = await db.authProvider.findUnique({ where: { id: provider.id } });
      expect(raw?.encryptedSecrets).toBeDefined();
      expect(typeof raw?.encryptedSecrets).toBe('string');
    });

    it('allows partial updates', async () => {
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.SAML,
        provider: 'okta-sso',
        name: 'Okta SSO',
        config: { metadataUrl: 'https://old.com' },
      }, { organization: org });

      const response = await userFetch(
        patch(`/api/v1/authProvider/${provider.id}`, {
          enabled: false,
        }),
      );
      const { data } = await json(response);

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(false);
      expect(data.name).toBe('Okta SSO');
    });

    it('rejects update without permission', async () => {
      const { entity: otherOrg } = await createOrganization();
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'other-provider',
        name: 'Other Provider',
      }, { organization: otherOrg });

      const response = await userFetch(
        patch(`/api/v1/authProvider/${provider.id}`, {
          enabled: false,
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/authProvider/:id', () => {
    it('deletes auth provider', async () => {
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'to-delete',
        name: 'To Delete',
      }, { organization: org });

      const response = await userFetch(del(`/api/v1/authProvider/${provider.id}`));
      expect(response.status).toBe(204);

      const found = await db.authProvider.findUnique({ where: { id: provider.id } });
      expect(found).toBeNull();
    });

    it('rejects delete without permission', async () => {
      const { entity: otherOrg } = await createOrganization();
      const { entity: provider } = await createAuthProvider({
        type: AuthProviderType.OAUTH,
        provider: 'protected',
        name: 'Protected',
      }, { organization: otherOrg });

      const response = await userFetch(del(`/api/v1/authProvider/${provider.id}`));
      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent provider', async () => {
      const response = await userFetch(del('/api/v1/authProvider/non-existent-id'));
      expect(response.status).toBe(404);
    });
  });
});
