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
import { integrationRouter } from '#/modules/integration';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { patch, post } from '#tests/utils/request';

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

describe('a malformed stored entitlement is pruned at sign-in, the rest kept (R91, R94)', () => {
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

  it('a token with no role keeps its well-formed entitlements; the broken one is gone', async () => {
    const key = await tokenKey(null, [readOrganization(), broken()]);
    expect(await actorModel(key)).toBe('Token');
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
  });

  it('a token with no role, not full, and nothing left after pruning is signed out (R94)', async () => {
    expect(await actorModel(await tokenKey(null, [broken()]))).toBeNull();
    expect(
      await actorModel(await tokenKey(null, { 'db:organization': { read: true } } as never)),
    ).toBeNull();
  });
});

describe('a token is the narrowing of its chain: a chain that holds nothing signs it out (R108)', () => {
  it('a token on an integration left with nothing after pruning has no actor', async () => {
    const { entity: empty } = await createIntegration({
      organizationId: organization.id,
      ownerModel: 'Organization',
      role: null,
      entitlements: [broken()],
    });
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'Integration', role: 'viewer' },
      { integration: empty },
    );
    expect(await actorModel(rawKey)).toBeNull();
  });
});

describe('the API refuses a malformed entitlement; a write prunes the broken ones stored (R94)', () => {
  const asOwner = async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'owner' },
      { organization },
    );
    return createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [
        (hono) => {
          hono.route('/api/v1/organization', organizationRouter);
          hono.route('/api/v1/integration', integrationRouter);
        },
      ],
    }).fetch;
  };

  it('the 422 names what is wrong with the entry', async () => {
    const noAction = { ...readOrganization(), actions: { read: false } };
    const response = await (await asOwner())(
      post(`/api/v1/organization/${organization.id}/integrations`, {
        name: `i-${crypto.randomUUID()}`,
        provider: 'slack',
        role: 'viewer',
        entitlements: [noAction],
      }),
    );
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toBe(
      'an entitlement grants at least one action',
    );
  });

  it('creating an integration with a malformed entitlement is a 422, and nothing is stored', async () => {
    const response = await (await asOwner())(
      post(`/api/v1/organization/${organization.id}/integrations`, {
        name: `i-${crypto.randomUUID()}`,
        provider: 'slack',
        role: 'viewer',
        entitlements: [broken()],
      }),
    );
    expect(response.status).toBe(422);
  });

  it('adding to an integration that stores a broken entry writes the good ones only', async () => {
    const { entity: stored } = await createIntegration({
      organizationId: organization.id,
      ownerModel: 'Organization',
      role: 'viewer',
      entitlements: [broken()],
    });
    const response = await (await asOwner())(
      patch(`/api/v1/integration/${stored.id}/entitlements`, { add: [readOrganization()] }),
    );
    expect(response.status).toBe(200);
    expect(
      (await db.integration.findUniqueOrThrow({ where: { id: stored.id } })).entitlements,
    ).toEqual([readOrganization()]);
  });
});

describe('on an integration, read and operate delegate up to manage (R101)', () => {
  it("a token whose only authority is manage on the organization's integrations also operates and reads them", async () => {
    const key = await tokenKey(null, [manageItsIntegrations()]);
    for (const action of ['manage', 'operate', 'read'])
      expect(await holds(key, 'integration', integration.id, action)).toBe(true);
  });
});
