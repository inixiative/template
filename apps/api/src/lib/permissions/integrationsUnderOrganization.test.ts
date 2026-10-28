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
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import type { Entry } from '#tests/utils/entitlementEntry';
import { del } from '#tests/utils/request';

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

const reach = async (key: string) => {
  const table: Record<string, string[]> = {};
  for (const kind of kinds) {
    table[kind] = [];
    for (const action of actions)
      if (await holds(key, 'integration', integrations[kind].id, action)) table[kind].push(action);
  }
  return table;
};

describe("integrations under an organization: the owner reaches every kind, an admin the organization's own (R82, R83)", () => {
  it('the owner holds every action on all four kinds', async () => {
    const all = [...actions];
    expect(await reach(await seatKey('owner'))).toEqual({
      Organization: all,
      Space: all,
      OrganizationUser: all,
      SpaceUser: all,
    });
  });

  it("an admin holds the organization's own integrations, short of own, and nothing of a space's or a member's", async () => {
    expect(await reach(await seatKey('admin'))).toEqual({
      Organization: ['read', 'operate', 'manage', 'delete'],
      Space: [],
      OrganizationUser: [],
      SpaceUser: [],
    });
  });
});

describe('tokens of integrations under an organization follow their integration (R83)', () => {
  const deletes = async (role: Role, kind: Kind) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'Integration', role: 'viewer' },
      { integration: integrations[kind] },
    );
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
    });
    return (await app.fetch(del(`/api/v1/token/${token.id}`))).status;
  };

  it("the owner deletes any of them; an admin only the organization's own integration's tokens", async () => {
    for (const kind of kinds) {
      expect(await deletes('owner', kind)).toBe(204);
      expect(await deletes('admin', kind)).toBe(kind === 'Organization' ? 204 : 403);
    }
  });
});
