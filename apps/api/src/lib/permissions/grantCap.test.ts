import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { clearHookRegistry, db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  Space,
  User,
} from '@template/db/generated/client/client';
import type { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';

registerClearCacheHook();

describe('a token never exceeds its user', () => {
  let user: User;
  let ownedOrganization: Organization;
  let viewedOrganization: Organization;
  let viewedMembership: OrganizationUser;
  let viewedSpace: Space;

  const app = createTestApp({
    mount: [
      (app) => {
        app.use('*', tokenAuthMiddleware);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/space', spaceRouter);
      },
    ],
  });

  const call = (key: string, method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const mint = async (
    role: Role,
    entitlements: Entitlements,
    entitlementsOnly = false,
    ownerModel: TokenOwnerModel = 'User',
  ) => {
    const key = randomUUID();
    const membership =
      ownerModel === 'OrganizationUser'
        ? { organizationUser: viewedMembership, organization: viewedOrganization }
        : {};
    await createToken(
      {
        ownerModel,
        role,
        entitlements: entitlements ?? undefined,
        entitlementsOnly,
        keyHash: createHash('sha256').update(key).digest('hex'),
      },
      { user, ...membership },
    );
    return key;
  };

  const rename = (key: string, path: string) =>
    call(key, 'PATCH', path, { name: `renamed-${randomUUID().slice(0, 6)}` });

  beforeAll(async () => {
    user = (await createUser()).entity;
    ownedOrganization = (await createOrganization()).entity;
    viewedOrganization = (await createOrganization()).entity;
    await createOrganizationUser({ role: 'owner' }, { user, organization: ownedOrganization });
    viewedMembership = (
      await createOrganizationUser({ role: 'viewer' }, { user, organization: viewedOrganization })
    ).entity;
    viewedSpace = (await createSpace({}, { organization: viewedOrganization })).entity;
    await createSpaceUser(
      { role: 'viewer' },
      {
        user,
        organization: viewedOrganization,
        space: viewedSpace,
        organizationUser: viewedMembership,
      },
    );
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  describe('default mode', () => {
    it('a viewer member with a { manage } User token cannot update the organization', async () => {
      const key = await mint('viewer', { manage: true });
      expect((await rename(key, `/organization/${viewedOrganization.id}`)).status).toBe(403);
    });

    it('a viewer space member with a { manage } User token cannot update the space', async () => {
      const key = await mint('viewer', { manage: true });
      expect((await rename(key, `/space/${viewedSpace.id}`)).status).toBe(403);
    });

    it('a { manage } OrganizationUser token on a viewer membership cannot update the organization', async () => {
      const key = await mint('viewer', { manage: true }, false, 'OrganizationUser');
      expect((await rename(key, `/organization/${viewedOrganization.id}`)).status).toBe(403);
    });

    it('an owner-role token cannot reach past a viewer membership', async () => {
      const key = await mint('owner', null);
      expect((await rename(key, `/organization/${viewedOrganization.id}`)).status).toBe(403);
      expect((await rename(key, `/space/${viewedSpace.id}`)).status).toBe(403);
    });

    it('an entitlement the membership holds is kept: viewer token + { manage } on an owned org', async () => {
      const key = await mint('viewer', { manage: true });
      expect((await rename(key, `/organization/${ownedOrganization.id}`)).status).toBe(200);
    });

    it('the token role still narrows: a viewer token cannot update the org it owns', async () => {
      const key = await mint('viewer', null);
      expect((await rename(key, `/organization/${ownedOrganization.id}`)).status).toBe(403);
      expect((await call(key, 'GET', `/organization/${ownedOrganization.id}/users`)).status).toBe(
        200,
      );
    });
  });

  describe('full grant (entitlements null)', () => {
    it('inherits the membership entitlements, live', async () => {
      const fullUser = (await createUser()).entity;
      const organization = (await createOrganization()).entity;
      const { entity: membership } = await createOrganizationUser(
        { role: 'viewer', entitlements: { manage: true } },
        { user: fullUser, organization },
      );
      const key = randomUUID();
      await createToken(
        {
          ownerModel: 'User',
          role: 'owner',
          keyHash: createHash('sha256').update(key).digest('hex'),
        },
        { user: fullUser },
      );
      expect((await rename(key, `/organization/${organization.id}`)).status).toBe(200);
      await db.organizationUser.update({
        where: { id: membership.id },
        data: { entitlements: {} },
      });
      expect((await rename(key, `/organization/${organization.id}`)).status).toBe(403);
    });

    it('does not inherit the login-only session actions', async () => {
      const key = await mint('owner', null);
      expect((await call(key, 'POST', '/me/tokens', { name: 't', role: 'viewer' })).status).toBe(
        403,
      );
    });
  });

  describe('entitlement-only mode', () => {
    it('grants nothing but its entitlements: { read } reads, cannot operate on an owned org', async () => {
      const key = await mint('owner', { read: true }, true);
      expect((await call(key, 'GET', `/organization/${ownedOrganization.id}/users`)).status).toBe(
        200,
      );
      expect((await call(key, 'GET', `/organization/${ownedOrganization.id}/tokens`)).status).toBe(
        403,
      );
      expect((await rename(key, `/organization/${ownedOrganization.id}`)).status).toBe(403);
    });

    it('is capped by the membership: { manage } updates the owned org, not the viewer org or space', async () => {
      const key = await mint('owner', { manage: true }, true);
      expect((await rename(key, `/organization/${ownedOrganization.id}`)).status).toBe(200);
      expect((await rename(key, `/organization/${viewedOrganization.id}`)).status).toBe(403);
      expect((await rename(key, `/space/${viewedSpace.id}`)).status).toBe(403);
      expect((await call(key, 'GET', `/organization/${viewedOrganization.id}/users`)).status).toBe(
        403,
      );
    });

    it('with no entitlements it can do nothing but know who it is', async () => {
      const key = await mint('owner', null, true);
      expect((await call(key, 'GET', '/me')).status).toBe(200);
      expect((await call(key, 'GET', '/me/contacts')).status).toBe(403);
      expect((await call(key, 'GET', `/organization/${ownedOrganization.id}/users`)).status).toBe(
        403,
      );
    });
  });
});
