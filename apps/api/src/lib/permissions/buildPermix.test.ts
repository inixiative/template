import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { setUserContext } from '#/lib/context/setUserContext';
import { buildPermix } from '#/lib/permissions/buildPermix';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { findUserWithRelations } from '#/modules/user/services/find';
import { createTestApp } from '#tests/createTestApp';

describe('buildPermix: the same actor gives the same permix from a request or called directly', () => {
  let user: User;
  let superadmin: User;
  let ownedOrganizationId: string;
  let viewedOrganizationId: string;
  let spaceId: string;

  const direct = async (userId: string) =>
    buildPermix({ user: await findUserWithRelations(userId), token: null, grant: null });

  const requestPath = (userId: string) =>
    createTestApp({
      mount: [
        (app) =>
          app.get('/permix/:id', async (c) => {
            const found = await findUserWithRelations(c.req.param('id'));
            if (found) await setUserContext(c, found);
            const permix = c.get('permix');
            return c.json({ grants: permix.getJSON(), superadmin: permix.isSuperadmin() });
          }),
      ],
    })
      .fetch(new Request(`http://test/permix/${userId}`))
      .then((response) => response.json() as Promise<{ grants: unknown; superadmin: boolean }>);

  beforeAll(async () => {
    user = (await createUser()).entity;
    superadmin = (await createUser({ platformRole: 'superadmin' })).entity;
    const owned = (await createOrganization()).entity;
    const viewed = (await createOrganization()).entity;
    ownedOrganizationId = owned.id;
    viewedOrganizationId = viewed.id;
    await createOrganizationUser({ role: 'owner' }, { user, organization: owned });
    const { context } = await createOrganizationUser(
      { role: 'viewer', entitlements: { 'report.export': true } },
      { user, organization: viewed },
    );
    const space = (await createSpace({}, { organization: viewed })).entity;
    spaceId = space.id;
    await createSpaceUser({ role: 'admin' }, { ...context, space });
  }, 20_000);

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('gives exactly the permissions the request path gives the same user', async () => {
    const permix = await direct(user.id);
    const viaRequest = await requestPath(user.id);
    expect(permix.getJSON()).toEqual(viaRequest.grants as never);
    expect(permix.isSuperadmin()).toBe(false);
  });

  it('answers the same checks', async () => {
    const permix = await direct(user.id);
    expect(check(permix, rebacSchema, 'organization', { id: ownedOrganizationId }, 'own')).toBe(
      true,
    );
    expect(check(permix, rebacSchema, 'organization', { id: viewedOrganizationId }, 'read')).toBe(
      true,
    );
    expect(check(permix, rebacSchema, 'organization', { id: viewedOrganizationId }, 'manage')).toBe(
      false,
    );
    expect(
      check(permix, rebacSchema, 'organization', { id: viewedOrganizationId }, 'report.export'),
    ).toBe(true);
    expect(check(permix, rebacSchema, 'space', { id: spaceId }, 'manage')).toBe(true);
    expect(check(permix, rebacSchema, 'user', { id: user.id }, 'token.create')).toBe(true);
  });

  it('a principal carrying a narrowed token matches the token request path', async () => {
    const key = randomUUID();
    const { entity: token } = await createToken(
      {
        ownerModel: 'User',
        role: 'owner',
        entitlements: { read: true, 'report.export': true },
        entitlementsOnly: true,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user },
    );
    const viaToken = (await createTestApp({
      mount: [
        (app) => {
          app.use('*', tokenAuthMiddleware);
          app.get('/permix', (c) => c.json(c.get('permix').getJSON()));
        },
      ],
    })
      .fetch(new Request('http://test/permix', { headers: { authorization: `Bearer ${key}` } }))
      .then((response) => response.json())) as unknown;
    const stored = await findUserWithRelations(user.id);
    if (!stored) throw new Error('expected the user');
    const permix = await buildPermix({
      user: stored,
      token: {
        ...token,
        user: stored,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
      },
      grant: {
        role: token.role,
        entitlements: { read: true, 'report.export': true },
        entitlementsOnly: true,
      },
    });
    expect(permix.getJSON()).toEqual(viaToken as never);
  });

  it('a superadmin is superadmin, as on the request path', async () => {
    const permix = await direct(superadmin.id);
    expect(permix.isSuperadmin()).toBe(true);
    expect((await requestPath(superadmin.id)).superadmin).toBe(true);
  });
});
