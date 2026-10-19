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
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
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
        app.route('/api/v1/organizationUser', organizationUserRouter);
        app.route('/api/v1/token', tokenRouter);
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
    const key = await mint(user, 'viewer', { 'user.rotateJwts': true, read: true });
    expect((await call(key, 'POST', '/me/rotateJwts')).status).toBe(204);
    expect((await call(key, 'POST', '/me/redact')).status).toBe(403);
  });

  it('a token never holds a person-only action, even when its entitlements name it (Aron, 2026-10-18)', async () => {
    for (const role of ['viewer', 'owner'] as const) {
      const key = await mint(user, role, {
        'token.create': true,
        'user.redact': true,
        'organization.delete': true,
        own: true,
        read: true,
      });
      expect(
        (
          await call(key, 'POST', '/me/tokens', {
            name: 't',
            role: 'viewer',
            entitlements: { read: true },
          })
        ).status,
      ).toBe(403);
      expect((await call(key, 'POST', '/me/redact')).status).toBe(403);
      expect((await call(key, 'DELETE', `/organization/${organization.id}`)).status).toBe(403);
    }
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

  it('a token naming token.create mints neither a full nor a narrowed token', async () => {
    const key = await mint(user, 'owner', { 'token.create': true, own: true });
    expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(403);
    expect(
      (
        await call(key, 'POST', '/me/tokens', {
          name: 't',
          role: 'viewer',
          entitlements: { read: true },
        })
      ).status,
    ).toBe(403);
  });

  it('a SpaceUser token knows who it is and holds nothing else on the user; a Space token holds nothing', async () => {
    const spaceOwner = (await createUser()).entity;
    const { context } = await createOrganizationUser({ role: 'owner' }, { user: spaceOwner });
    const { entity: spaceUser, context: spaceContext } = await createSpaceUser(
      { role: 'owner' },
      context,
    );
    const spaceUserKey = randomUUID();
    await createToken(
      {
        ownerModel: 'SpaceUser',
        role: 'owner',
        keyHash: createHash('sha256').update(spaceUserKey).digest('hex'),
      },
      { ...spaceContext, spaceUser },
    );
    expect((await call(spaceUserKey, 'GET', '/me')).status).toBe(200);
    expect((await call(spaceUserKey, 'GET', '/me/contacts')).status).toBe(403);
    expect(
      (await call(spaceUserKey, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status,
    ).toBe(403);
    expect(
      (await call(spaceUserKey, 'POST', '/organization', { name: 'n', slug: randomUUID() })).status,
    ).toBe(403);

    const spaceKey = randomUUID();
    await createToken(
      {
        ownerModel: 'Space',
        role: 'owner',
        keyHash: createHash('sha256').update(spaceKey).digest('hex'),
      },
      { organization: spaceContext.organization, space: spaceContext.space },
    );
    expect((await call(spaceKey, 'GET', '/me')).status).toBe(401);
  });

  it('a token naming token.create cannot mint or widen a membership token', async () => {
    const issuer = (await createUser()).entity;
    const { entity: issuerMembership, context } = await createOrganizationUser(
      { role: 'owner', entitlements: { 'billing.export': true } },
      { user: issuer },
    );
    const key = await mint(issuer, 'owner', { 'token.create': true, manage: true });
    const path = `/organizationUser/${issuerMembership.id}/tokens`;
    expect((await call(key, 'POST', path, { name: 't', role: 'member' })).status).toBe(403);
    expect(
      (await call(key, 'POST', path, { name: 't', role: 'member', entitlements: { read: true } }))
        .status,
    ).toBe(403);

    const { entity: narrowedToken } = await createToken(
      {
        ownerModel: 'OrganizationUser',
        role: 'member',
        entitlements: { read: true },
        keyHash: createHash('sha256').update(randomUUID()).digest('hex'),
      },
      { ...context, organizationUser: issuerMembership },
    );
    expect(
      (await call(key, 'PATCH', `/token/${narrowedToken.id}`, { entitlements: null })).status,
    ).toBe(403);
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
        name: 'entitlementGrant',
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
