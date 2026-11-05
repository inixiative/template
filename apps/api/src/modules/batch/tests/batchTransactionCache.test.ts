import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { cacheKey, clearKey, db, unregisterDbHook } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { batchRouter } from '#/modules/batch';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';

type SubResult = { status: number; body: unknown };
type Role = 'owner' | 'viewer';

const { call } = createTokenProbeApp((hono) => {
  hono.route('/api/v1/batch', batchRouter);
  hono.post('/api/v1/probe/role/:id/:role', async (c) => {
    await db.organizationUser.update({
      where: { id: c.req.param('id') },
      data: { role: c.req.param('role') as Role },
    });
    return c.json({});
  });
  hono.post('/api/v1/probe/remove/:id', async (c) => {
    await db.organizationUser.delete({ where: { id: c.req.param('id') } });
    return c.json({});
  });
  hono.post('/api/v1/probe/evict', async (c) => {
    await clearKey(((await c.req.json()) as { key: string }).key);
    return c.json({});
  });
  hono.post('/api/v1/probe/fail', (c) => c.json({ message: 'forced failure' }, 400));
});

const holdsOwn = (organizationId: string) => ({
  method: 'POST',
  path: '/api/v1/probe/holds',
  body: { model: 'organization', id: organizationId, action: 'own' },
});
const setRole = (id: string, role: Role) => ({
  method: 'POST',
  path: `/api/v1/probe/role/${id}/${role}`,
});

const transactionAll = async (rawKey: string, rounds: unknown[][]) => {
  const response = await call(rawKey, 'POST', '/api/v1/batch/execute', {
    requests: rounds,
    strategy: 'transactionAll',
  });
  return (
    (await response.json()) as { data: { batch: SubResult[][]; summary: { status: string } } }
  ).data;
};

const held = (result: SubResult | undefined) => (result?.body as { holds?: boolean } | null)?.holds;

const memberWithToken = async (role: Role) => {
  const member = await createOrganizationUser({ role });
  const token = await createKeyedToken(
    { ownerModel: 'OrganizationUser', role: 'owner' },
    { organizationUser: member.entity },
  );
  const memberKey = cacheKey('organizationUser', {
    organizationId: member.entity.organizationId,
    userId: member.entity.userId,
  });
  return { member, token, memberKey, organizationId: member.entity.organizationId };
};

describe('a batch in one transaction reads its own permission changes, and a rollback leaves none behind', () => {
  beforeAll(() => registerClearCacheHook());
  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  it('a member demoted in round 0 no longer holds the role in round 1', async () => {
    const { member, token, organizationId } = await memberWithToken('owner');
    const { batch } = await transactionAll(token.rawKey, [
      [holdsOwn(organizationId), setRole(member.entity.id, 'viewer')],
      [holdsOwn(organizationId)],
    ]);
    expect(held(batch[0]?.[0])).toBe(true);
    expect(held(batch[1]?.[0])).not.toBe(true);
  });

  it('a member removed in round 0 no longer holds the role in round 1', async () => {
    const { member, token, organizationId } = await memberWithToken('owner');
    const { batch } = await transactionAll(token.rawKey, [
      [
        holdsOwn(organizationId),
        { method: 'POST', path: `/api/v1/probe/remove/${member.entity.id}` },
      ],
      [holdsOwn(organizationId)],
    ]);
    expect(held(batch[1]?.[0])).not.toBe(true);
  });

  it('a promotion in a batch that rolls back grants nothing afterwards, even when the key was cold', async () => {
    const { member, token, memberKey, organizationId } = await memberWithToken('viewer');
    const { summary } = await transactionAll(token.rawKey, [
      [
        setRole(member.entity.id, 'owner'),
        { method: 'POST', path: '/api/v1/probe/evict', body: { key: memberKey } },
      ],
      [holdsOwn(organizationId), { method: 'POST', path: '/api/v1/probe/fail' }],
    ]);
    expect(summary.status).toBe('failed');

    const response = await call(token.rawKey, 'POST', '/api/v1/probe/holds', {
      model: 'organization',
      id: organizationId,
      action: 'own',
    });
    expect(((await response.json()) as { holds: boolean }).holds).toBe(false);
  });
});
