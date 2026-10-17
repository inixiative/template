import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import type { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';

describe('actions on the user itself', () => {
  let user: User;
  let superadmin: User;
  let organization: Organization;
  let membership: OrganizationUser;

  const tokenApp = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
      },
    ],
  });

  const call = (key: string, method: string, path: string, body?: unknown) =>
    tokenApp.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const mint = async (
    owner: User,
    role: Role,
    entitlements: Entitlements = null,
    ownerModel: TokenOwnerModel = 'User',
    entitlementsOnly = false,
  ) => {
    const key = randomUUID();
    await createToken(
      {
        ownerModel,
        role,
        entitlements: entitlements ?? undefined,
        entitlementsOnly,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      ownerModel === 'OrganizationUser'
        ? { user: owner, organization, organizationUser: membership }
        : { user: owner },
    );
    return key;
  };

  const session = (sessionUser: User) =>
    createTestApp({
      mockUser: sessionUser,
      mount: [
        (app) => {
          app.route('/api/v1/me', meRouter);
          app.route('/api/v1/organization', organizationRouter);
        },
      ],
    });

  const post = (path: string, body: unknown) =>
    new Request(`http://test/api/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    user = (await createUser()).entity;
    superadmin = (await createUser({ platformRole: 'superadmin' })).entity;
    organization = (await createOrganization()).entity;
    membership = (await createOrganizationUser({ role: 'owner' }, { user, organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('a session mints tokens', async () => {
    const response = await session(user).fetch(post('/me/tokens', { name: 's', role: 'viewer' }));
    expect(response.status).toBe(201);
  });

  it('an owner-role token holds no session action', async () => {
    const key = await mint(user, 'owner');
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(403);
    expect((await call(key, 'POST', '/me/redact')).status).toBe(403);
    expect((await call(key, 'DELETE', `/organization/${organization.id}`)).status).toBe(403);
  });

  it('a token holds a session action its entitlements name, and nothing else', async () => {
    const key = await mint(user, 'viewer', { 'token.create': true });
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(201);
    expect((await call(key, 'POST', '/me/redact')).status).toBe(403);
  });

  it('a superadmin token is superadmin', async () => {
    const key = await mint(superadmin, 'viewer');
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(201);
  });

  it('me routes check the user: a viewer token reads, but cannot create', async () => {
    const key = await mint(user, 'viewer');
    expect((await call(key, 'GET', '/me')).status).toBe(200);
    expect((await call(key, 'GET', '/me/contacts')).status).toBe(200);
    expect(
      (
        await call(key, 'POST', '/me/contacts', {
          type: 'linkedin',
          value: { url: `https://linkedin.com/in/${randomUUID().slice(0, 8)}` },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(key, 'POST', '/organization', { name: 'n', slug: randomUUID() })).status,
    ).toBe(403);
  });

  it('a member token creates on the user', async () => {
    const key = await mint(user, 'member');
    expect(
      (await call(key, 'POST', '/organization', { name: 'n', slug: randomUUID() })).status,
    ).toBe(201);
  });

  it('an OrganizationUser token knows who it is, and nothing else about the user', async () => {
    const key = await mint(user, 'owner', null, 'OrganizationUser');
    expect((await call(key, 'GET', '/me')).status).toBe(200);
    expect((await call(key, 'GET', '/me/contacts')).status).toBe(403);
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(403);
  });

  it('a minter cannot mint a role above its own: { token.create } only cannot mint an owner token', async () => {
    const key = await mint(user, 'owner', { 'token.create': true }, 'User', true);
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'owner' })).status).toBe(403);
  });

  it('the role is capped on every membership, not only on the user', async () => {
    const issuer = (await createUser()).entity;
    const memberOrganization = (await createOrganization()).entity;
    await createOrganizationUser(
      { role: 'member' },
      { user: issuer, organization: memberOrganization },
    );
    const key = await mint(issuer, 'viewer', { own: true, 'token.create': true });
    expect((await call(key, 'GET', `/organization/${memberOrganization.id}/users`)).status).toBe(
      200,
    );
    expect((await call(key, 'GET', `/organization/${memberOrganization.id}/tokens`)).status).toBe(
      403,
    );
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'owner' })).status).toBe(403);
  });

  it('a minter cannot grant an action it does not hold', async () => {
    const key = await mint(user, 'viewer', { 'token.create': true });
    const response = await call(key, 'POST', '/me/tokens', {
      name: 't',
      role: 'viewer',
      entitlements: { 'user.redact': true },
    });
    expect(response.status).toBe(403);
  });

  it('a session mints an entitlement-only token that holds only what it names', async () => {
    const response = await session(user).fetch(
      post('/me/tokens', {
        name: 'slice',
        role: 'owner',
        entitlements: { read: true },
        entitlementsOnly: true,
      }),
    );
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { key: string } };
    expect((await call(data.key, 'GET', `/organization/${organization.id}/users`)).status).toBe(
      200,
    );
    expect(
      (await call(data.key, 'PATCH', `/organization/${organization.id}`, { name: 'x' })).status,
    ).toBe(403);
  });
});
