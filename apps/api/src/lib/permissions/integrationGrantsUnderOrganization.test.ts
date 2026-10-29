import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Integration, Organization, Role } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { patch } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

type Kind = 'Organization' | 'Space' | 'OrganizationUser' | 'SpaceUser';
const kinds: Kind[] = ['Organization', 'Space', 'OrganizationUser', 'SpaceUser'];
const actions = ['read', 'operate', 'manage', 'own', 'delete'] as const;

let organization: Organization;
const integrations = {} as Record<Kind, Integration>;

beforeAll(async () => {
  registerClearCacheHook();
  ({ entity: organization } = await createOrganization());
  const { entity: space } = await createSpace({}, { organization });
  const { entity: member, context } = await createOrganizationUser(
    { role: 'member' },
    { organization },
  );
  const { entity: spaceMember } = await createSpaceUser({ role: 'member' }, { ...context, space });
  const at = { organizationId: organization.id, role: 'viewer' as const };
  integrations.Organization = (
    await createIntegration({ ...at, ownerModel: 'Organization' })
  ).entity;
  integrations.Space = (
    await createIntegration({ ...at, ownerModel: 'Space', spaceId: space.id })
  ).entity;
  integrations.OrganizationUser = (
    await createIntegration({ ...at, ownerModel: 'OrganizationUser', userId: member.userId })
  ).entity;
  integrations.SpaceUser = (
    await createIntegration({
      ...at,
      ownerModel: 'SpaceUser',
      spaceId: space.id,
      userId: spaceMember.userId,
    })
  ).entity;
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const seatKey = async (role: Role, entitlements?: Entry[]) => {
  const { entity: seat } = await createOrganizationUser({ role, entitlements }, { organization });
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', full: true, role: null },
      { organizationUser: seat },
    )
  ).rawKey;
};

const _reach = async (key: string) => {
  const table: Record<string, string[]> = {};
  for (const kind of kinds) {
    table[kind] = [];
    for (const action of actions)
      if (await holds(key, 'integration', integrations[kind].id, action)) table[kind].push(action);
  }
  return table;
};

describe('granted: the where narrows the kinds an entitlement under the organization reaches (R81, R83)', () => {
  const grant = async (role: Role, granted: Entry) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { entity: target } = await createOrganizationUser({ role: 'viewer' }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    return (
      await app.fetch(
        patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [granted] }),
      )
    ).status;
  };

  const underOrganization = (where?: Entry['where']) => ({
    ...entry('db:integration', ['db:organization', organization.id, 'organization'], ['manage']),
    ...(where ? { where } : {}),
  });
  const theOrganizations = () =>
    underOrganization({ field: 'ownerModel', operator: 'equals', value: 'Organization' });

  it('unfiltered, it reaches all four kinds: the owner grants it, an admin does not', async () => {
    expect(await grant('owner', underOrganization())).toBe(200);
    expect(await grant('admin', underOrganization())).toBe(403);
  });

  it("where ownerModel = Organization: an admin grants managing the organization's own integrations", async () => {
    expect(await grant('admin', theOrganizations())).toBe(200);
  });

  it('the holder of the unfiltered grant manages all four kinds', async () => {
    const key = await seatKey('viewer', [underOrganization()]);
    for (const kind of kinds)
      expect(await holds(key, 'integration', integrations[kind].id, 'manage')).toBe(true);
  });

  it("the holder of the filtered grant manages the organization's own, nothing else", async () => {
    const key = await seatKey('viewer', [theOrganizations()]);
    expect(await holds(key, 'integration', integrations.Organization.id, 'manage')).toBe(true);
    for (const kind of ['Space', 'OrganizationUser', 'SpaceUser'] as const)
      expect(await holds(key, 'integration', integrations[kind].id, 'manage')).toBe(false);
  });

  const kindsIn = (...values: Kind[]) =>
    underOrganization({ field: 'ownerModel', operator: 'in', value: values });

  it('where ownerModel in [...]: an admin grants the kinds it holds, not one more (R88)', async () => {
    expect(await grant('admin', kindsIn('Organization'))).toBe(200);
    expect(await grant('admin', kindsIn('Organization', 'OrganizationUser'))).toBe(403);
    expect(await grant('owner', kindsIn('Organization', 'OrganizationUser'))).toBe(200);
  });

  it('every leaf of a root `all` narrows; a nested rule narrows nothing (R88)', async () => {
    const both = underOrganization({
      all: [
        { field: 'ownerModel', operator: 'in', value: ['Organization', 'OrganizationUser'] },
        { field: 'ownerModel', operator: 'in', value: ['Organization', 'Space'] },
      ],
    });
    expect(await grant('admin', both)).toBe(200);
    const nested = underOrganization({
      all: [{ all: [{ field: 'ownerModel', operator: 'equals', value: 'Organization' }] }],
    });
    expect(await grant('admin', nested)).toBe(403);
  });

  it('the holder of an `in` grant manages the kinds it names, nothing else', async () => {
    const key = await seatKey('viewer', [kindsIn('Organization', 'OrganizationUser')]);
    expect(await holds(key, 'integration', integrations.Organization.id, 'manage')).toBe(true);
    expect(await holds(key, 'integration', integrations.OrganizationUser.id, 'manage')).toBe(true);
    for (const kind of ['Space', 'SpaceUser'] as const)
      expect(await holds(key, 'integration', integrations[kind].id, 'manage')).toBe(false);
  });
});
