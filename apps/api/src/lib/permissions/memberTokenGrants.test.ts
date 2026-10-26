import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { type AccessorName, db, fetchOne, hydrate, unregisterDbHook } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';

const mintKey = () => {
  const rawKey = randomBytes(24).toString('hex');
  return {
    rawKey,
    fields: {
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 16),
    },
  };
};

const { app: tokenApp } = createTestApp({
  mount: [
    (app) => {
      app.use('*', tokenAuthMiddleware);
      app.get('/grants', (c) => c.json(c.get('permix').getJSON()));
      app.post('/holds', async (c) => {
        const { model, id, action } = (await c.req.json()) as {
          model: AccessorName;
          id: string;
          action: string;
        };
        const row = await fetchOne<{ id: string }>(model, id);
        if (!row) return c.json({ holds: false });
        const record = await hydrate(model, row);
        return c.json({ holds: check(c.get('permix'), rebacSchema, model, record, action) });
      });
      app.route('/api/v1/me', meRouter);
      app.route('/api/v1/organization', organizationRouter);
    },
  ],
});

const grantsFor = async (rawKey: string) => {
  const response = await tokenApp.request('/grants', {
    headers: { authorization: `Bearer ${rawKey}` },
  });
  expect(response.status).toBe(200);
  const grants = (await response.json()) as Record<string, Record<string, boolean>>;
  return Object.fromEntries(
    Object.entries(grants).map(([key, actions]) => [
      key,
      Object.keys(actions).filter((action) => actions[action]),
    ]),
  );
};

const holds = async (rawKey: string, model: AccessorName, id: string, action: string) => {
  const response = await tokenApp.request('/holds', {
    method: 'POST',
    headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, id, action }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { holds: boolean }).holds;
};

describe('a member token holds its member row, never the user (template #210 7f651bcc)', () => {
  let organization: Organization;
  let space: Space;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('an OrganizationUser token: its org at its role, and nothing else', async () => {
    const { entity: organizationUser, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'OrganizationUser', role: 'owner', ...fields },
      { organizationUser },
    );

    expect(await grantsFor(rawKey)).toEqual({});
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(true);
    expect(await holds(rawKey, 'organization', organization.id, 'own')).toBe(false);
    expect(await holds(rawKey, 'user', context.user.id, 'read')).toBe(false);
  });

  it('a SpaceUser token: its space at its role, and not the organization', async () => {
    const { context } = await createOrganizationUser({ role: 'admin' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'owner', ...fields }, { spaceUser });

    expect(await grantsFor(rawKey)).toEqual({});
    expect(await holds(rawKey, 'space', space.id, 'own')).toBe(true);
    expect(await holds(rawKey, 'organization', organization.id, 'read')).toBe(false);
  });

  it('a SpaceUser token below its member row holds the lesser role', async () => {
    const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'viewer', ...fields }, { spaceUser });

    expect(await holds(rawKey, 'space', space.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'space', space.id, 'operate')).toBe(false);
  });

  it('a token create stored on a member mints nothing: minting is create on a token, and only a user mints', async () => {
    const { entity: organizationUser } = await createOrganizationUser(
      {
        role: 'member',
        entitlements: [
          {
            resource: 'db:token',
            anchor: { resource: 'db:organization', id: organization.id },
            actions: { create: true },
          },
        ],
      },
      { organization },
    );
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'OrganizationUser', full: true, role: null, ...fields },
      { organizationUser },
    );

    const response = await tokenApp.request(`/api/v1/organization/${organization.id}/tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'k', role: 'viewer' }),
    });
    expect(response.status).toBe(403);
  });

  it('a SpaceUser token has no me: /me answers 401', async () => {
    const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'member' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'member', ...fields }, { spaceUser });

    const response = await tokenApp.request('/api/v1/me', {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    expect(response.status).toBe(401);
  });
});

describe('full skips one step at every link: token, integration, member (Aron, 2026-10-26)', () => {
  let organization: Organization;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const chain = async (
    integrationPermissions: { role: 'member' | null; full: boolean },
    tokenPermissions: { role: 'viewer' | null; full: boolean },
  ) => {
    const { context } = await createOrganizationUser({ role: 'admin' }, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: context.user.id,
      ...integrationPermissions,
    });
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'Integration', ...tokenPermissions, ...fields },
      { integration },
    );
    return (action: string) => holds(rawKey, 'organization', organization.id, action);
  };

  it('full token, full integration: the member', async () => {
    const may = await chain({ role: null, full: true }, { role: null, full: true });
    expect(await may('manage')).toBe(true);
    expect(await may('own')).toBe(false);
  });

  it('full token, member integration: the integration', async () => {
    const may = await chain({ role: 'member', full: false }, { role: null, full: true });
    expect(await may('operate')).toBe(true);
    expect(await may('manage')).toBe(false);
  });

  it('viewer token, full integration: viewer under the member', async () => {
    const may = await chain({ role: null, full: true }, { role: 'viewer', full: false });
    expect(await may('read')).toBe(true);
    expect(await may('operate')).toBe(false);
  });

  it('viewer token, member integration: viewer under member under the member', async () => {
    const may = await chain({ role: 'member', full: false }, { role: 'viewer', full: false });
    expect(await may('read')).toBe(true);
    expect(await may('operate')).toBe(false);
  });
});

describe('a member token follows its member row as soon as the row changes', () => {
  let organization: Organization;

  beforeAll(async () => {
    registerClearCacheHook();
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  it('a demoted member row takes its token down with it', async () => {
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'OrganizationUser', role: 'admin', ...fields },
      { organizationUser },
    );
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(true);

    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { role: 'viewer' },
    });

    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(false);
  });
});

describe("a member's entitlements are owned by its organization (Aron, 2026-10-26)", () => {
  let organization: Organization;
  let space: Space;
  let otherSpace: Space;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    const { entity: otherOrganization } = await createOrganization();
    ({ entity: otherSpace } = await createSpace({}, { organization: otherOrganization }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const entitledMember = async (anchor: Space) => {
    const { entity: organizationUser } = await createOrganizationUser(
      {
        role: 'viewer',
        entitlements: [
          {
            resource: 'db:space',
            anchor: { resource: 'db:space', id: anchor.id },
            actions: { operate: true },
          },
        ],
      },
      { organization },
    );
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'OrganizationUser', full: true, role: null, ...fields },
      { organizationUser },
    );
    return rawKey;
  };

  it('an entitlement inside the organization holds', async () => {
    const key = await entitledMember(space);
    expect(await holds(key, 'space', space.id, 'operate')).toBe(true);
    expect(await holds(key, 'space', space.id, 'manage')).toBe(false);
  });

  it('an entitlement anchored outside the organization holds nothing', async () => {
    const key = await entitledMember(otherSpace);
    expect(await holds(key, 'space', otherSpace.id, 'read')).toBe(false);
  });
});
