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
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { post } from '#tests/utils/request';

describe('every route names its action; a token is never a user (Aron, 2026-10-23)', () => {
  let user: User;
  let superadmin: User;
  let organization: Organization;
  let member: OrganizationUser;

  const tokenApp = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
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

  const mint = async (owner: User, role: Role, ownerModel: TokenOwnerModel = 'User') => {
    const key = randomUUID();
    const { entity } = await createToken(
      { ownerModel, role, keyHash: createHash('sha256').update(key).digest('hex') },
      ownerModel === 'OrganizationUser'
        ? { user: owner, organization, organizationUser: member }
        : { user: owner },
    );
    return { key, token: entity };
  };

  const webhook = () => ({ model: 'CustomerRef', url: `https://example.com/${randomUUID()}` });

  beforeAll(async () => {
    ({ entity: user } = await createUser());
    ({ entity: superadmin } = await createUser({ platformRole: 'superadmin' }));
    ({ entity: organization } = await createOrganization());
    ({ entity: member } = await createOrganizationUser({ role: 'owner' }, { user, organization }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('a user mints a token; an owner-role token holding own on its user does not', async () => {
    const userApp = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [member],
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    expect(
      (await userApp.fetch(post('/api/v1/me/tokens', { name: 'k', role: 'owner' }))).status,
    ).toBe(201);

    const { key } = await mint(user, 'owner');
    expect((await call(key, 'POST', '/me/tokens', { name: 'k', role: 'viewer' })).status).toBe(403);
  });

  it('the user-only operations refuse every token and leave the rows in place', async () => {
    const { key } = await mint(user, 'owner');
    const { token: sibling } = await mint(user, 'viewer');

    expect((await call(key, 'DELETE', `/token/${sibling.id}`)).status).toBe(403);
    expect((await call(key, 'POST', '/me/rotateJwts')).status).toBe(403);
    expect((await call(key, 'POST', '/me/redact')).status).toBe(403);
    expect((await call(key, 'DELETE', `/organization/${organization.id}`)).status).toBe(403);

    expect(await db.token.findUnique({ where: { id: sibling.id } })).not.toBeNull();
    expect(await db.organization.findUnique({ where: { id: organization.id } })).not.toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  it("a superadmin's token passes a user-only check", async () => {
    const { key } = await mint(superadmin, 'owner');
    expect((await call(key, 'POST', '/me/tokens', { name: 'k', role: 'viewer' })).status).toBe(201);
  });

  it('a viewer token reads the user and creates nothing on them', async () => {
    const { key } = await mint(user, 'viewer');
    expect((await call(key, 'GET', '/me')).status).toBe(200);
    expect((await call(key, 'GET', '/me/organizations')).status).toBe(200);
    expect((await call(key, 'POST', '/me/webhookSubscriptions', webhook())).status).toBe(403);
  });

  it('any token its user owns creates an organization', async () => {
    const { key } = await mint(user, 'viewer');
    expect(
      (await call(key, 'POST', '/organization', { name: 'o', slug: randomUUID() })).status,
    ).toBe(201);
  });

  it('a member token creates on the user, including an organization', async () => {
    const { key } = await mint(user, 'member');
    expect((await call(key, 'POST', '/me/webhookSubscriptions', webhook())).status).toBe(201);
    expect(
      (await call(key, 'POST', '/organization', { name: 'o', slug: randomUUID() })).status,
    ).toBe(201);
  });

  it('an OrganizationUser token has no me: /me answers 401', async () => {
    const { key } = await mint(user, 'owner', 'OrganizationUser');
    expect((await call(key, 'GET', '/me')).status).toBe(401);
    expect((await call(key, 'GET', '/me/organizations')).status).toBe(401);
    expect((await call(key, 'GET', '/me/tokens')).status).toBe(401);
    expect((await call(key, 'POST', '/me/webhookSubscriptions', webhook())).status).toBe(401);
  });
});
