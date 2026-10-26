import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  Token,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createToken,
  createUser,
} from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';

describe('a token of an organization member acts as that member, never as the user or the organization (Aron, 2026-10-25)', () => {
  let user: User;
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let member: OrganizationUser;
  let userToken: Token;
  let key: string;

  const app = createTestApp({
    mount: [
      (hono) => {
        hono.use('*', tokenAuthMiddleware);
        hono.route('/api/v1/me', meRouter);
        hono.route('/api/v1/organization', organizationRouter);
        hono.route('/api/v1/organizationUser', organizationUserRouter);
        hono.route('/api/v1/space', spaceRouter);
        hono.route('/api/v1/token', tokenRouter);
      },
    ],
  });

  const call = (method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const status = async (method: string, path: string, body?: unknown) =>
    (await call(method, path, body)).status;

  beforeAll(async () => {
    ({ entity: user } = await createUser());
    ({ entity: organization } = await createOrganization());
    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    ({ entity: member } = await createOrganizationUser({ role: 'owner' }, { user, organization }));
    await createOrganizationUser({ role: 'owner' }, { user, organization: otherOrganization });
    ({ entity: userToken } = await createToken(
      { ownerModel: 'User', role: 'owner', keyHash: randomUUID() },
      { user },
    ));

    ({ rawKey: key } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'owner' },
      { user, organization, organizationUser: member },
    ));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('acts on its organization as its member does', async () => {
    expect(await status('GET', '/me')).toBe(401);
    expect(await status('GET', `/organization/${organization.id}/protected`)).toBe(200);
    expect(await status('GET', `/organization/${organization.id}`)).toBe(200);
    expect(await status('PATCH', `/organization/${organization.id}`, { name: 'Renamed' })).toBe(
      200,
    );
    expect(await status('GET', `/space/${space.id}`)).toBe(200);
  });

  it('does nothing only the user may do', async () => {
    expect(await status('GET', '/me/organizations')).toBe(401);
    expect(await status('GET', '/me/tokens')).toBe(401);
    expect(await status('POST', '/me/tokens', { name: 'k', role: 'viewer' })).toBe(401);
    expect(await status('POST', '/me/rotateJwts')).toBe(401);
    expect(await status('POST', '/me/redact')).toBe(401);
    expect(
      await status('POST', '/me/webhookSubscriptions', {
        model: 'CustomerRef',
        url: `https://example.com/${randomUUID()}`,
      }),
    ).toBe(401);
    expect(await status('POST', '/organization', { name: 'o', slug: randomUUID() })).toBe(403);
    expect(await status('DELETE', `/token/${userToken.id}`)).toBe(403);

    expect(await db.token.findUnique({ where: { id: userToken.id } })).not.toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });

  it('does nothing only a user over the organization may do, though its member owns it', async () => {
    expect(
      await status('POST', `/organization/${organization.id}/tokens`, {
        name: 'k',
        role: 'viewer',
      }),
    ).toBe(403);
    expect(
      await status('POST', `/organizationUser/${member.id}/tokens`, { name: 'k', role: 'viewer' }),
    ).toBe(403);
    expect(await status('DELETE', `/organization/${organization.id}`)).toBe(403);

    expect(await db.organization.findUnique({ where: { id: organization.id } })).not.toBeNull();
    expect(
      await db.token.count({
        where: { organizationId: organization.id, ownerModel: 'Organization' },
      }),
    ).toBe(0);
  });

  it('reaches no other organization its user sits in', async () => {
    expect(await status('GET', `/organization/${otherOrganization.id}/protected`)).toBe(403);
    expect(await status('PATCH', `/organization/${otherOrganization.id}`, { name: 'Taken' })).toBe(
      403,
    );
  });
});
