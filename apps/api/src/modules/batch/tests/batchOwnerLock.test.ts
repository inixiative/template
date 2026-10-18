import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Segment, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSegment,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { batchRouter } from '#/modules/batch';
import type { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { segmentRouter } from '#/modules/segment';
import { createTestApp } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

type BatchExecuteResponse = z.infer<typeof batchExecuteRoute.responseSchema>;
type Strategy = 'transactionAll' | 'transactionPerRound' | 'allowFailures' | 'failOnRound';
type SubRequest = { method: string; path: string; body?: unknown };

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const gate = () => {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
};

const settles = (promise: Promise<unknown>, withinMs: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    sleep(withinMs).then(() => false),
  ]);

describe('batch sub-requests under the owner lock', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let space: Space;
  let first: Segment;
  let second: Segment;
  let reached = gate();
  let release = gate();

  const save = (segment: Segment, conditions: unknown): SubRequest => ({
    method: 'PATCH',
    path: `/api/v1/segment/${segment.id}`,
    body: { conditions },
  });
  const hold: SubRequest = { method: 'POST', path: '/api/v1/test/hold' };

  const runBatch = async (strategy: Strategy, requests: SubRequest[][]) => {
    const response = await fetch(post('/api/v1/batch/execute', { strategy, requests }));
    return (await json<BatchExecuteResponse>(response)).data;
  };

  const conditionsOf = async (segment: Segment) =>
    (await db.segment.findUnique({ where: { id: segment.id } }))?.conditions;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    const { entity: organizationUser, context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
    const { entity: spaceUser } = await createSpaceUser({ role: 'admin' }, { ...context, space });
    fetch = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [organizationUser],
      mockSpaceUsers: [spaceUser],
      mount: [
        (app) => app.route('/api/v1/batch', batchRouter),
        (app) => app.route('/api/v1/segment', segmentRouter),
        (app) =>
          app.post('/api/v1/test/hold', async (c) => {
            reached.open();
            await release.opened;
            return c.json({ data: null });
          }),
        (app) =>
          app.post('/api/v1/test/transaction', async (c) =>
            c.json({
              data: await db.txn(async () => {
                const [row] = await db.$queryRaw<{ id: bigint }[]>`SELECT txid_current() AS id`;
                await sleep(100);
                return String(row?.id);
              }),
            }),
          ),
      ],
    }).fetch;
  });

  beforeEach(async () => {
    reached = gate();
    release = gate();
    first = (await createSegment({ ownerModel: 'Space', conditions: acmeRule }, { space })).entity;
    second = (await createSegment({ ownerModel: 'Space', conditions: acmeRule }, { space })).entity;
  });

  afterAll(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  describe('transactionAll', () => {
    it('holds the lock until the batch commits, so a racing save sees the committed graph and is refused', async () => {
      const holding = runBatch('transactionAll', [[save(first, membersOf(second.id))], [hold]]);
      await reached.opened;

      const racing = runBatch('transactionAll', [[save(second, membersOf(first.id))]]);
      const racedBeforeCommit = await settles(racing, 1_000);

      release.open();
      const [held, raced] = await Promise.all([holding, racing]);

      expect(racedBeforeCommit).toBe(false);
      expect(held.summary.status).toBe('success');
      expect(raced.summary.status).toBe('failed');
      expect(raced.batch[0]?.[0]?.status).toBe(422);
      expect(await conditionsOf(first)).toEqual(membersOf(second.id));
      expect(await conditionsOf(second)).toEqual(acmeRule);
    });

    it('releases the lock when the batch rolls back', async () => {
      const failed = await runBatch('transactionAll', [
        [save(first, membersOf(second.id))],
        [{ method: 'GET', path: '/api/v1/segment/not-a-segment' }],
      ]);
      expect(failed.summary.status).toBe('failed');
      expect(await conditionsOf(first)).toEqual(acmeRule);

      const next = withOwnerLock(
        { ownerModel: 'Space', ownerId: space.id },
        'rules',
        async () => 'ran',
      );
      expect(await settles(next, 300)).toBe(true);
      expect(await next).toBe('ran');
    });

    it('takes the same owner lock again across rounds without waiting on itself', async () => {
      const started = Date.now();
      const result = await runBatch('transactionAll', [
        [save(first, membersOf(second.id))],
        [save(second, acmeRule)],
        [save(first, acmeRule)],
      ]);

      expect(result.summary.status).toBe('success');
      expect(Date.now() - started).toBeLessThan(2_000);
    });

    it('takes the same owner lock from parallel sub-requests of one round without waiting on itself', async () => {
      const started = Date.now();
      const result = await runBatch('transactionAll', [
        [save(first, membersOf(second.id)), save(second, { ...acmeRule, value: '@beta.test' })],
      ]);

      expect(result.summary.status).toBe('success');
      expect(Date.now() - started).toBeLessThan(2_000);
    });

    it("refuses the cycle when one batch's parallel sub-requests close it", async () => {
      const result = await runBatch('transactionAll', [
        [save(first, membersOf(second.id)), save(second, membersOf(first.id))],
      ]);

      expect(result.summary.status).toBe('failed');
      expect(await conditionsOf(first)).toEqual(acmeRule);
      expect(await conditionsOf(second)).toEqual(acmeRule);
    });
  });

  describe('transactionPerRound', () => {
    it('releases the lock when its round commits, not at the end of the batch', async () => {
      const holding = runBatch('transactionPerRound', [
        [save(first, membersOf(second.id))],
        [hold],
      ]);
      await reached.opened;

      const racing = runBatch('transactionAll', [[save(second, membersOf(first.id))]]);
      const racedBeforeBatchEnd = await settles(racing, 2_000);

      release.open();
      const [held, raced] = await Promise.all([holding, racing]);

      expect(racedBeforeBatchEnd).toBe(true);
      expect(held.summary.status).toBe('success');
      expect(raced.summary.status).toBe('failed');
      expect(raced.batch[0]?.[0]?.status).toBe(422);
      expect(await conditionsOf(second)).toEqual(acmeRule);
    });
  });

  describe.each(['allowFailures', 'failOnRound'] as const)('%s', (strategy) => {
    it('runs each sub-request of a round in its own transaction', async () => {
      const transaction: SubRequest = { method: 'POST', path: '/api/v1/test/transaction' };
      const result = await runBatch(strategy, [[transaction, transaction]]);

      expect(result.summary.status).toBe('success');
      const [one, two] = result.batch[0] ?? [];
      expect(one?.body.data).not.toBe(two?.body.data);
    });
  });

  describe('allowFailures', () => {
    it('releases the lock as each sub-request commits', async () => {
      const holding = runBatch('allowFailures', [[save(first, membersOf(second.id))], [hold]]);
      await reached.opened;

      const next = withOwnerLock(
        { ownerModel: 'Space', ownerId: space.id },
        'rules',
        async () => 'ran',
      );
      const ranBeforeBatchEnd = await settles(next, 2_000);

      release.open();
      expect(ranBeforeBatchEnd).toBe(true);
      expect((await holding).summary.status).toBe('success');
    });
  });
});
