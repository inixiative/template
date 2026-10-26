import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type AccessorName, db, unregisterDbHook } from '@template/db';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';

type Probe = { model: AccessorName; id: string; action: string };
type SubResult = { status: number; body: unknown };

const { call } = createTokenProbeApp((hono) => {
  hono.route('/api/v1/batch', batchRouter);
  hono.route('/api/v1/me', meRouter);
  hono.post('/api/v1/probe/demote/:id', async (c) => {
    await db.organizationUser.update({
      where: { id: c.req.param('id') },
      data: { role: 'viewer' },
    });
    return c.json({});
  });
  hono.post('/api/v1/probe/deactivate/:id', async (c) => {
    await db.token.update({ where: { id: c.req.param('id') }, data: { isActive: false } });
    return c.json({});
  });
});

const holdsRequest = (probe: Probe) => ({
  method: 'POST',
  path: '/api/v1/probe/holds',
  body: probe,
});

const batch = async (rawKey: string, rounds: unknown[][]) => {
  const response = await call(rawKey, 'POST', '/api/v1/batch/execute', {
    requests: rounds,
    strategy: 'allowFailures',
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

  const mint = async (fields: Record<string, unknown>, owners: Record<string, unknown>) =>
    (await createKeyedToken({ role: 'owner', ...fields }, owners)).rawKey;

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

  const ownerTokens = [
    {
      name: 'an organization token holds its organization in every round, acting as a token',
      key: () => mint({ ownerModel: 'Organization' }, { organization: orgA }),
      holds: (): Probe => ({ model: 'organization', id: orgA.id, action: 'own' }),
      lacks: (): Probe => ({ model: 'organization', id: orgB.id, action: 'read' }),
    },
    {
      name: 'a space token holds its space in every round, acting as a token',
      key: () => mint({ ownerModel: 'Space' }, { space: spaceA }),
      holds: (): Probe => ({ model: 'space', id: spaceA.id, action: 'own' }),
      lacks: (): Probe => ({ model: 'organization', id: orgA.id, action: 'read' }),
    },
  ];

  for (const row of ownerTokens)
    it(row.name, async () => {
      const round = [
        holdsRequest(row.holds()),
        holdsRequest(row.lacks()),
        { method: 'GET', path: '/api/v1/probe/actor' },
      ];

      const [first, second] = await batch(await row.key(), [round, round]);

      for (const results of [first, second]) {
        expect(results.slice(0, 2).map(held)).toEqual([true, false]);
        expect(results[2]).toEqual({
          status: 200,
          body: { actor: expect.objectContaining({ model: 'Token' }) },
        });
      }
    });
});

describe('a batch signs its token in again between rounds', () => {
  beforeAll(() => registerClearCacheHook());
  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  it('a member demoted in one round loses the role in the next', async () => {
    const { entity: organizationUser, context } = await createOrganizationUser({ role: 'owner' });
    const key = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'owner' },
      { organizationUser },
    );
    const own = holdsRequest({ model: 'organization', id: context.organization.id, action: 'own' });

    const [first, second] = await batch(key.rawKey, [
      [own, { method: 'POST', path: `/api/v1/probe/demote/${organizationUser.id}` }],
      [own],
    ]);

    expect(held(first[0])).toBe(true);
    expect(held(second[0])).toBe(false);
  });

  it('a token deactivated in one round ends the batch with 401', async () => {
    const { entity: user } = await createUser();
    const { entity: token, rawKey } = await createKeyedToken(
      { ownerModel: 'User', role: 'owner' },
      { user },
    );

    const response = await call(rawKey, 'POST', '/api/v1/batch/execute', {
      requests: [
        [{ method: 'POST', path: `/api/v1/probe/deactivate/${token.id}` }],
        [{ method: 'GET', path: '/api/v1/probe/actor' }],
      ],
      strategy: 'allowFailures',
    });

    expect(response.status).toBe(401);
  });
});
