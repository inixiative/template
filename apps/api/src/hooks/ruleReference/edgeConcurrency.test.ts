import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { type Condition, Operator } from '@inixiative/json-rules';
import {
  clearHookRegistry,
  db,
  regenerateRuleReferenceEdges,
  registerSoftDeleteScoper,
  ruleReferences,
} from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSegment,
  createSpace,
} from '@template/db/test';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRuleReferenceTargetHook } from '#/hooks/ruleReference/targetHook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';

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

// The contender's blocked FOR UPDATE is observed in pg_stat_activity before the holder mutates, so
// the contender has provably finished its unlocked reads against the live row; a fixed delay would
// only guess at that and make the race flaky in both directions.
const waitForBlockedLockOn = async (table: string): Promise<void> => {
  const pattern = `%"${table}"%FOR UPDATE%`;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const rows = await db.$queryRaw<{ n: bigint | number }[]>`
      SELECT COUNT(*) AS n FROM pg_stat_activity
      WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query ILIKE ${pattern}`;
    if (Number(rows[0]?.n ?? 0) > 0) return;
    await sleep(25);
  }
  throw new Error(`no contender blocked on ${table}`);
};

const settles = (promise: Promise<unknown>, withinMs: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    sleep(withinMs).then(() => false),
  ]);

const edgesOf = (segmentId: string) =>
  db.ruleReference.findMany({ where: { segmentId }, orderBy: { createdAt: 'asc' } });

describe('ruleReference — edges under concurrency and repair', () => {
  let space: Space;
  let owner: { ownerModel: string; ownerId: string };

  beforeAll(async () => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerPreventHardDeleteHook();
    registerRulesHook();
    registerSegmentConditionsHook();
    registerSegmentRuleReferencesHook();
    registerRuleReferenceTargetHook();
    registerSoftDeleteCascadeHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
    owner = { ownerModel: 'Space', ownerId: space.id };
  });

  afterAll(async () => {
    clearHookRegistry();
    registerSoftDeleteScoper(null);
    await cleanupTouchedTables(db);
  });

  afterEach(async () => {
    await db.ruleReference.deleteMany({});
  });

  describe('a save racing the delete of the row it names', () => {
    it('waits for the delete to commit and is then refused, never written live against a dead row', async () => {
      const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
      const { entity: other } = await createSegment({ conditions: acmeRule }, { space });
      const held = gate();
      const release = gate();

      const holder = db.txn(
        async () => {
          await db.findForUpdate('Segment', { id: { in: [target.id] } });
          held.open();
          await release.opened;
          await db.segment.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
        },
        { timeout: 30_000 },
      );
      await held.opened;

      const save = db.segment.update({
        where: { id: other.id },
        data: { conditions: membersOf(target.id) },
      });
      const outcome = save.then(
        () => 'saved',
        () => 'refused',
      );
      try {
        await waitForBlockedLockOn('Segment');
      } finally {
        release.open();
        await holder;
      }

      expect(await outcome).toBe('refused');
      expect(await edgesOf(other.id)).toEqual([]);
      expect(
        (await db.withDeleted(() => db.segment.findUnique({ where: { id: other.id } })))
          ?.conditions,
      ).toEqual(acmeRule);
    });
  });

  describe('rebuild restamps in place', () => {
    const rebuild = (segment: { id: string; conditions: unknown }) =>
      db.txn(() =>
        regenerateRuleReferenceEdges(
          { model: 'Segment', id: segment.id },
          ruleReferences(customerRefLens, segment.conditions as Condition),
        ),
      );

    it('repairs a drifted stamp and keeps the edge id', async () => {
      const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
      const { entity: dependent } = await createSegment(
        { conditions: membersOf(target.id) },
        { space },
      );
      const [edge] = await edgesOf(dependent.id);
      await db.$executeRaw`UPDATE "RuleReference" SET "targetDeletedAt" = '2026-01-01T00:00:00Z' WHERE "id" = ${edge?.id}`;

      await rebuild(dependent);

      const [after] = await edgesOf(dependent.id);
      expect(after?.id).toBe(edge?.id);
      expect(after?.targetDeletedAt).toBeNull();
    });

    it('stamps an edge whose target died behind the hooks, keeps the id, and a second rebuild changes nothing', async () => {
      const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
      const { entity: dependent } = await createSegment(
        { conditions: membersOf(target.id) },
        { space },
      );
      const [edge] = await edgesOf(dependent.id);
      await db.$executeRaw`UPDATE "Segment" SET "deletedAt" = '2026-09-30T12:00:00Z' WHERE "id" = ${target.id}`;

      await rebuild(dependent);
      const [stamped] = await edgesOf(dependent.id);
      expect(stamped?.id).toBe(edge?.id);
      expect(stamped?.targetDeletedAt?.toISOString()).toBe('2026-09-30T12:00:00.000Z');

      await rebuild(dependent);
      expect(await edgesOf(dependent.id)).toEqual([stamped]);
    });
  });

  describe('the owner lock', () => {
    const holdOwner = async (held: { ownerModel: string; ownerId: string }) => {
      const taken = gate();
      const release = gate();
      const holder = withOwnerLock(held, 'rules', async () => {
        taken.open();
        await release.opened;
      });
      await taken.opened;
      return async () => {
        release.open();
        await holder;
      };
    };

    it('queues a second rules change for the same owner behind the first', async () => {
      const release = await holdOwner(owner);
      const second = withOwnerLock(owner, 'rules', async () => 'ran');

      expect(await settles(second, 200)).toBe(false);

      await release();
      expect(await second).toBe('ran');
    });

    it("lets another owner's change through while this owner's lock is held", async () => {
      const release = await holdOwner(owner);
      const elsewhere = withOwnerLock(
        { ownerModel: 'Space', ownerId: 'elsewhere' },
        'rules',
        async () => 'ran',
      );

      expect(await settles(elsewhere, 2_000)).toBe(true);
      await release();
    });

    it('gives up with a 409 when the lock stays held past the wait', async () => {
      const release = await holdOwner(owner);

      const error = await withOwnerLock(owner, 'rules', async () => 'ran', 200).catch(
        (err: unknown) => err,
      );
      expect((error as { status?: number }).status).toBe(409);

      await release();
    });
  });
});
