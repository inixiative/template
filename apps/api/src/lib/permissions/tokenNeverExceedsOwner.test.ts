import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Role, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
} from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';

const { call, holds } = createTokenProbeApp((hono) =>
  hono.route('/api/v1/organization', organizationRouter),
);

type Actions = Record<string, boolean> | null;

describe('a credential never exceeds its owner (Aron, 2026-10-23)', () => {
  let organization: Organization;
  let space: Space;

  const onOrganization = (actions: Actions) =>
    actions
      ? [
          {
            resource: 'db:organization',
            anchor: { resource: 'db:organization', id: organization.id },
            actions,
          },
        ]
      : undefined;

  const member = (role: Role, entitlements: Actions = null) =>
    createOrganizationUser({ role, entitlements: onOrganization(entitlements) }, { organization });

  const token = async (
    ownerModel: 'User' | 'OrganizationUser',
    organizationUser: Awaited<ReturnType<typeof member>>,
    role: Role,
    entitlements: Actions = null,
  ) =>
    (
      await createKeyedToken(
        { ownerModel, role, entitlements: onOrganization(entitlements) },
        ownerModel === 'User'
          ? { user: organizationUser.context.user }
          : { organizationUser: organizationUser.entity },
      )
    ).rawKey;

  const userToken = (
    organizationUser: Awaited<ReturnType<typeof member>>,
    role: Role,
    entitlements: Actions = null,
  ) => token('User', organizationUser, role, entitlements);

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it("a viewer member's token naming manage still cannot manage the organization", async () => {
    const key = await userToken(await member('viewer'), 'owner', { manage: true });
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
    expect(
      (await call(key, 'PATCH', `/api/v1/organization/${organization.id}`, { name: 'x' })).status,
    ).toBe(403);
    expect((await call(key, 'GET', `/api/v1/organization/${organization.id}`)).status).toBe(200);
  });

  it("an admin member's owner-role token manages the organization and does not own it", async () => {
    const key = await userToken(await member('admin'), 'owner');
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'own')).toBe(false);
  });

  it("a token's role is capped by its member, the member's entitlements included", async () => {
    const key = await userToken(await member('viewer', { operate: true }), 'owner');
    expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
  });

  it('the cap follows the walk: a space is reached only as far as the member reaches its organization', async () => {
    const owner = await member('owner');
    expect(await holds(await userToken(owner, 'owner'), 'space', space.id, 'manage')).toBe(true);
    expect(await holds(await userToken(owner, 'viewer'), 'space', space.id, 'read')).toBe(false);
  });

  it("a member's owner-role token on an admin member manages and does not own", async () => {
    const key = await token('OrganizationUser', await member('admin'), 'owner', { own: true });
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'own')).toBe(false);
  });

  it('a user token below its member row holds the lesser', async () => {
    const key = await userToken(await member('owner'), 'viewer');
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
  });
});
