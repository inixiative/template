import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { type AccessorName, db, fetchOne, hydrate } from '@template/db';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';

type Probe = { model: AccessorName; id: string; action: string };
type SubResult = { status: number; body: unknown };

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
      hono.route('/api/v1/batch', batchRouter);
      hono.route('/api/v1/me', meRouter);
      hono.get('/api/v1/probe/actor', (c) => c.json({ actor: c.get('permix').getActor() }));
      hono.post('/api/v1/probe/holds', async (c) => {
        const { model, id, action } = (await c.req.json()) as Probe;
        const row = await fetchOne<{ id: string }>(model, id);
        if (!row) return c.json({ holds: false });
        const record = await hydrate(model, row);
        return c.json({ holds: check(c.get('permix'), rebacSchema, model, record, action) });
      });
    },
  ],
});

const holdsRequest = (probe: Probe) => ({
  method: 'POST',
  path: '/api/v1/probe/holds',
  body: probe,
});

const batch = async (rawKey: string, rounds: unknown[][]) => {
  const response = await app.request('/api/v1/batch/execute', {
    method: 'POST',
    headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: rounds, strategy: 'allowFailures' }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { batch: SubResult[][] } }).data.batch;
};

const held = (result: SubResult) => (result.body as { holds: boolean }).holds;

describe('a batch keeps every round inside its credential (Aron, 2026-10-25)', () => {
  let user: User;
  let orgA: Organization;
  let orgB: Organization;
  let spaceA: Space;
  let spaceB: Space;
  let memberA: Awaited<ReturnType<typeof createOrganizationUser>>;
  let spaceMemberA: Awaited<ReturnType<typeof createSpaceUser>>;

  const mint = async (fields: Record<string, unknown>, owners: Record<string, unknown>) => {
    const key = mintKey();
    await createToken({ role: 'owner', ...fields, ...key.fields }, owners);
    return key.rawKey;
  };

  beforeAll(async () => {
    ({ entity: user } = await createUser());
    ({ entity: orgA } = await createOrganization());
    ({ entity: orgB } = await createOrganization());
    ({ entity: spaceA } = await createSpace({}, { organization: orgA }));
    ({ entity: spaceB } = await createSpace({}, { organization: orgB }));
    memberA = await createOrganizationUser({ role: 'owner' }, { user, organization: orgA });
    const memberB = await createOrganizationUser({ role: 'owner' }, { user, organization: orgB });
    spaceMemberA = await createSpaceUser({ role: 'owner' }, { ...memberA.context, space: spaceA });
    await createSpaceUser({ role: 'owner' }, { ...memberB.context, space: spaceB });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('an organization member token reaches no space of another organization in a later round', async () => {
    const key = await mint(
      { ownerModel: 'OrganizationUser' },
      { organizationUser: memberA.entity },
    );
    const otherSpace = holdsRequest({ model: 'space', id: spaceB.id, action: 'own' });
    const ownOrg = holdsRequest({ model: 'organization', id: orgA.id, action: 'own' });

    const [first, second] = await batch(key, [[otherSpace], [otherSpace, ownOrg]]);

    expect(held(first[0])).toBe(false);
    expect(held(second[0])).toBe(false);
    expect(held(second[1])).toBe(true);
  });

  it('a space member token reaches no organization in a later round', async () => {
    const key = await mint({ ownerModel: 'SpaceUser' }, { spaceUser: spaceMemberA.entity });
    const own = holdsRequest({ model: 'space', id: spaceA.id, action: 'own' });
    const [, second] = await batch(key, [
      [own],
      [
        holdsRequest({ model: 'organization', id: orgA.id, action: 'own' }),
        holdsRequest({ model: 'organization', id: orgB.id, action: 'own' }),
        holdsRequest({ model: 'space', id: spaceB.id, action: 'own' }),
        own,
      ],
    ]);

    expect(second.map(held)).toEqual([false, false, false, true]);
  });

  it('a user token keeps every member of its user across rounds', async () => {
    const key = await mint({ ownerModel: 'User' }, { user });
    const both = [
      holdsRequest({ model: 'organization', id: orgA.id, action: 'own' }),
      holdsRequest({ model: 'organization', id: orgB.id, action: 'own' }),
    ];

    const [first, second] = await batch(key, [both, both]);

    expect(first.map(held)).toEqual([true, true]);
    expect(second.map(held)).toEqual([true, true]);
  });

  it('an organization token holds its organization in every round, acting as a token', async () => {
    const key = await mint({ ownerModel: 'Organization' }, { organization: orgA });
    const round = [
      holdsRequest({ model: 'organization', id: orgA.id, action: 'own' }),
      holdsRequest({ model: 'organization', id: orgB.id, action: 'read' }),
      { method: 'GET', path: '/api/v1/probe/actor' },
    ];

    const [first, second] = await batch(key, [round, round]);

    for (const results of [first, second]) {
      expect(results.slice(0, 2).map(held)).toEqual([true, false]);
      expect(results[2]).toEqual({
        status: 200,
        body: { actor: expect.objectContaining({ model: 'Token' }) },
      });
    }
  });

  it('a space token holds its space in every round, acting as a token', async () => {
    const key = await mint({ ownerModel: 'Space' }, { space: spaceA });
    const round = [
      holdsRequest({ model: 'space', id: spaceA.id, action: 'own' }),
      holdsRequest({ model: 'organization', id: orgA.id, action: 'read' }),
      { method: 'GET', path: '/api/v1/probe/actor' },
    ];

    const [first, second] = await batch(key, [round, round]);

    for (const results of [first, second]) {
      expect(results.slice(0, 2).map(held)).toEqual([true, false]);
      expect(results[2]).toEqual({
        status: 200,
        body: { actor: expect.objectContaining({ model: 'Token' }) },
      });
    }
  });
});
