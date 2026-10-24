import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
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

describe('a membership token holds its membership and knows who it is, never the user (template #210 7f651bcc)', () => {
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

    expect(await grantsFor(rawKey)).toEqual({
      [`db:user:${context.user.id}`]: ['user.identify'],
      [`db:organization:${organization.id}`]: ['manage'],
    });
  });

  it('a SpaceUser token: its space at its role, and nothing else', async () => {
    const { context } = await createOrganizationUser({ role: 'admin' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'owner', ...fields }, { spaceUser });

    expect(await grantsFor(rawKey)).toEqual({
      [`db:user:${context.user.id}`]: ['user.identify'],
      [`db:space:${space.id}`]: ['own'],
    });
  });

  it('a SpaceUser token below its membership holds the lesser role', async () => {
    const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: spaceUser } = await createSpaceUser({ role: 'owner' }, { ...context, space });
    const { rawKey, fields } = mintKey();
    await createToken({ ownerModel: 'SpaceUser', role: 'viewer', ...fields }, { spaceUser });

    expect(await grantsFor(rawKey)).toEqual({
      [`db:user:${context.user.id}`]: ['user.identify'],
      [`db:space:${space.id}`]: ['read'],
    });
  });
});
