import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Integration, Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';

const { call, holds } = createTokenProbeApp();

let organization: Organization;
let integration: Integration;

beforeAll(async () => {
  registerClearCacheHook();
  ({ entity: organization } = await createOrganization());
  ({ entity: integration } = await createIntegration({
    organizationId: organization.id,
    ownerModel: 'Organization',
    role: 'viewer',
  }));
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const broken = () => entry('db:integration', ['db:organization', organization.id], ['read']);
const readOrganization = () =>
  entry('db:organization', ['db:organization', organization.id], ['read']);
const manageItsIntegrations = (): Entry => ({
  ...entry('db:integration', ['db:organization', organization.id, 'organization'], ['manage']),
  where: { field: 'ownerModel', operator: 'equals', value: 'Organization' },
});

const memberKey = async (entitlements: Entry[]) => {
  const { entity: organizationUser } = await createOrganizationUser(
    { role: 'viewer', entitlements },
    { organization },
  );
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: null, full: true },
      { organizationUser },
    )
  ).rawKey;
};

const tokenKey = async (role: 'viewer' | null, entitlements: Entry[]) => {
  const { entity: organizationUser } = await createOrganizationUser(
    { role: 'owner' },
    { organization },
  );
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', role, full: false, entitlements },
      { organizationUser },
    )
  ).rawKey;
};

const actorModel = async (key: string) =>
  (
    (await (await call(key, 'GET', '/api/v1/probe/actor')).json()) as {
      actor: { model: string } | null;
    }
  ).actor?.model ?? null;

describe('a malformed stored entitlement is dropped at sign-in, the rest kept (R91)', () => {
  it('a member keeps its role and its other entitlements; the broken one is gone', async () => {
    const key = await memberKey([manageItsIntegrations(), broken()]);
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'integration', integration.id, 'manage')).toBe(true);
  });

  it('a token with a role keeps its role and its other entitlements', async () => {
    const key = await tokenKey('viewer', [manageItsIntegrations(), broken()]);
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'integration', integration.id, 'manage')).toBe(true);
  });

  it('a token with no role stands on its entitlements: a broken one signs it out', async () => {
    const intact = await tokenKey(null, [readOrganization()]);
    expect(await actorModel(intact)).toBe('Token');
    expect(await holds(intact, 'organization', organization.id, 'read')).toBe(true);
    const withBroken = await tokenKey(null, [readOrganization(), broken()]);
    expect(await actorModel(withBroken)).toBeNull();
    expect(await holds(withBroken, 'organization', organization.id, 'read')).toBe(false);
  });
});
