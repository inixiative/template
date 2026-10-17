import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { clearHookRegistry } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { organizationRouter } from '#/modules/organization';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { patch } from '#tests/utils/request';

registerClearCacheHook();

describe('PATCH /token/:id — a token is full or narrowed, and either can change', () => {
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let organization: Organization;
  let membership: OrganizationUser;
  let admin: User;
  let adminMembership: OrganizationUser;
  let viewer: User;
  let viewerMembership: OrganizationUser;

  const tokenApp = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/token', tokenRouter);
        app.route('/api/v1/organization', organizationRouter);
      },
    ],
  });

  const asSession = (sessionUser: User, memberships: OrganizationUser[]) =>
    createTestApp({
      mockUser: sessionUser,
      mockOrganizationUsers: memberships,
      mount: [(app) => app.route('/api/v1/token', tokenRouter)],
    }).fetch;

  const withKey = (key: string, method: string, path: string, body?: unknown) =>
    tokenApp.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const userToken = async (
    role: Role,
    entitlements: Entitlements = null,
    entitlementsOnly = false,
  ) => {
    const key = randomUUID();
    const { entity } = await createToken(
      {
        ownerModel: 'User',
        role,
        entitlements: entitlements ?? undefined,
        entitlementsOnly,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user },
    );
    return { key, token: entity };
  };

  const rename = (key: string) =>
    withKey(key, 'PATCH', `/organization/${organization.id}`, {
      name: `n-${randomUUID().slice(0, 6)}`,
    });

  beforeAll(async () => {
    user = (await createUser()).entity;
    organization = (await createOrganization()).entity;
    membership = (await createOrganizationUser({ role: 'owner' }, { user, organization })).entity;
    admin = (await createUser()).entity;
    adminMembership = (
      await createOrganizationUser({ role: 'admin' }, { user: admin, organization })
    ).entity;
    viewer = (await createUser()).entity;
    viewerMembership = (
      await createOrganizationUser({ role: 'viewer' }, { user: viewer, organization })
    ).entity;
    db = createTestApp().db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('the owner narrows a full token, then makes it full again', async () => {
    const { key, token } = await userToken('owner');
    expect((await rename(key)).status).toBe(200);

    const narrowed = await asSession(user, [membership])(
      patch(`/api/v1/token/${token.id}`, { entitlements: { read: true }, entitlementsOnly: true }),
    );
    expect(narrowed.status).toBe(200);
    expect((await rename(key)).status).toBe(403);

    const full = await asSession(user, [membership])(
      patch(`/api/v1/token/${token.id}`, { entitlements: null, entitlementsOnly: false }),
    );
    expect(full.status).toBe(200);
    expect((await rename(key)).status).toBe(200);
  });

  it('a token cannot change itself', async () => {
    const { key, token } = await userToken('owner', { 'token.create': true, read: true });
    const response = await withKey(key, 'PATCH', `/token/${token.id}`, {
      entitlements: { read: true },
    });
    expect(response.status).toBe(403);
  });

  it('a narrowed editor cannot make a token full', async () => {
    const { key } = await userToken('owner', { 'token.create': true, own: true });
    const { token: other } = await userToken('owner', { read: true }, true);
    const response = await withKey(key, 'PATCH', `/token/${other.id}`, {
      entitlements: null,
      entitlementsOnly: false,
    });
    expect(response.status).toBe(403);
  });

  it('another user cannot change my token', async () => {
    const { token } = await userToken('owner');
    const response = await asSession(viewer, [viewerMembership])(
      patch(`/api/v1/token/${token.id}`, { entitlements: { read: true } }),
    );
    expect(response.status).toBe(403);
  });

  describe('organization tokens: assign rules, capped by what the editor can assign', () => {
    const orgToken = async () =>
      (await createToken({ ownerModel: 'Organization', role: 'member' }, { organization })).entity;

    it('an admin grants a member-level entitlement', async () => {
      const token = await orgToken();
      const response = await asSession(admin, [adminMembership])(
        patch(`/api/v1/token/${token.id}`, { entitlements: { 'report.export': true } }),
      );
      expect(response.status).toBe(200);
      const saved = await db.token.findUniqueOrThrow({ where: { id: token.id } });
      expect(saved.entitlements).toEqual({ 'report.export': true });
    });

    it('an admin cannot raise it to owner or grant own', async () => {
      const token = await orgToken();
      expect(
        (
          await asSession(admin, [adminMembership])(
            patch(`/api/v1/token/${token.id}`, { role: 'owner' }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await asSession(admin, [adminMembership])(
            patch(`/api/v1/token/${token.id}`, { entitlements: { own: true } }),
          )
        ).status,
      ).toBe(403);
    });

    it('a viewer cannot change it at all', async () => {
      const token = await orgToken();
      const response = await asSession(viewer, [viewerMembership])(
        patch(`/api/v1/token/${token.id}`, { entitlements: { read: true } }),
      );
      expect(response.status).toBe(403);
    });
  });
});
