import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { type AccessorName, db, fetchOne, hydrate } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { meRouter } from '#/modules/me';
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

describe('a membership token holds its membership, never the user (template #210 7f651bcc)', () => {
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

  it('a SpaceUser token below its membership holds the lesser role', async () => {
    const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'viewer', ...fields }, { spaceUser });

    expect(await holds(rawKey, 'space', space.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'space', space.id, 'operate')).toBe(false);
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
