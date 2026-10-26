import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { type AccessorName, db, fetchOne, hydrate } from '@template/db';
import type { Organization, Role, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createToken,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
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

const { app } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', tokenAuthMiddleware);
      hono.route('/api/v1/organization', organizationRouter);
      hono.post('/holds', async (c) => {
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
    },
  ],
});

const call = (key: string, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const holds = async (key: string, model: AccessorName, id: string, action: string) => {
  const response = await call(key, 'POST', '/holds', { model, id, action });
  expect(response.status).toBe(200);
  return ((await response.json()) as { holds: boolean }).holds;
};

describe('a credential never exceeds its owner (Aron, 2026-10-23)', () => {
  let organization: Organization;
  let space: Space;

  const onOrganization = (actions: Entitlements) =>
    actions
      ? [
          {
            resource: 'db:organization',
            anchor: { resource: 'db:organization', id: organization.id },
            actions,
          },
        ]
      : undefined;

  const member = (role: Role, entitlements: Entitlements = null) =>
    createOrganizationUser({ role, entitlements: onOrganization(entitlements) }, { organization });

  const userToken = async (
    organizationUser: Awaited<ReturnType<typeof member>>,
    role: Role,
    entitlements: Entitlements = null,
  ) => {
    const { rawKey, fields } = mintKey();
    await createToken(
      { ownerModel: 'User', role, entitlements: onOrganization(entitlements), ...fields },
      { user: organizationUser.context.user },
    );
    return rawKey;
  };

  const memberToken = async (
    organizationUser: Awaited<ReturnType<typeof member>>,
    role: Role,
    entitlements: Entitlements = null,
  ) => {
    const { rawKey, fields } = mintKey();
    await createToken(
      {
        ownerModel: 'OrganizationUser',
        role,
        entitlements: onOrganization(entitlements),
        ...fields,
      },
      { organizationUser: organizationUser.entity },
    );
    return rawKey;
  };

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
    const key = await memberToken(await member('admin'), 'owner', { own: true });
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'own')).toBe(false);
  });

  it('a user token below its member row holds the lesser', async () => {
    const key = await userToken(await member('owner'), 'viewer');
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
  });
});
