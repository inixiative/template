import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type {
  Integration,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { integrationRouter } from '#/modules/integration';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { get } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

let user: User;
let seat: OrganizationUser;
let ownIntegration: Integration;
let memberIntegration: Integration;

beforeAll(async () => {
  registerClearCacheHook();
  const { entity: organization } = await createOrganization();
  const { entity, context } = await createOrganizationUser({ role: 'member' }, { organization });
  seat = entity;
  user = context.user;
  ({ entity: ownIntegration } = await createIntegration({
    ownerModel: 'User',
    userId: user.id,
    role: 'viewer',
  }));
  ({ entity: memberIntegration } = await createIntegration({
    ownerModel: 'OrganizationUser',
    organizationId: organization.id,
    userId: user.id,
    role: 'viewer',
  }));
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const userKey = async (permissions: { role: Role | null; full?: boolean }) =>
  (await createKeyedToken({ ownerModel: 'User', ...permissions }, { user })).rawKey;

describe("a user's own tokens on the user's integrations", () => {
  it('a full User token is the user: it manages the integration', async () => {
    expect(
      await holds(
        await userKey({ role: null, full: true }),
        'integration',
        ownIntegration.id,
        'manage',
      ),
    ).toBe(true);
  });

  it('an owner-role User token manages it', async () => {
    expect(
      await holds(await userKey({ role: 'owner' }), 'integration', ownIntegration.id, 'manage'),
    ).toBe(true);
  });

  it('a viewer-role User token reads it and manages nothing: being its user is not enough', async () => {
    const key = await userKey({ role: 'viewer' });
    expect(await holds(key, 'integration', ownIntegration.id, 'read')).toBe(true);
    expect(await holds(key, 'integration', ownIntegration.id, 'manage')).toBe(false);
    expect(await holds(key, 'integration', ownIntegration.id, 'delete')).toBe(false);
  });

  it('the user, signed in, reads their own member integration', async () => {
    const { fetch } = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/integration', integrationRouter)],
    });
    expect((await fetch(get(`/api/v1/integration/${memberIntegration.id}`))).status).toBe(200);
  });
});
