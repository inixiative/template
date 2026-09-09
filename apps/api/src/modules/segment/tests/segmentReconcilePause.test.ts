import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { SegmentReconcilePauseReason, SegmentType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganizationUser, createSegment, createSpace } from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { applyPauseVerdicts } from '#/modules/segment/services/segmentReconcilePause';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

describe('segment reconcile pause', () => {
  let space: Space;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('pauses a reference loop that arrived out of band and names it', async () => {
    const { entity: a } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: b } = await createSegment({ type: SegmentType.dynamic, conditions: membersOf(a.id) }, { space });
    const loopedA = await db.segment.update({ where: { id: a.id }, data: { conditions: membersOf(b.id) } });

    const verdicts = await applyPauseVerdicts([loopedA, b]);
    for (const segment of verdicts) {
      expect(segment.reconcilePausedReason).toBe(SegmentReconcilePauseReason.cycle);
      expect(segment.reconcilePausedDetail).toContain(a.id);
      expect(segment.reconcilePausedDetail).toContain(b.id);
    }
  });

  it('pauses a rule naming a segment that is gone, and clears the pause once it resolves again', async () => {
    const { entity: target } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: dependent } = await createSegment(
      { type: SegmentType.dynamic, conditions: membersOf(target.id) },
      { space },
    );

    const [paused] = await applyPauseVerdicts([dependent]);
    expect(paused!.reconcilePausedReason).toBe(SegmentReconcilePauseReason.danglingReference);
    expect(paused!.reconcilePausedDetail).toBe(target.id);

    const [cleared] = await applyPauseVerdicts([paused!, target]);
    expect(cleared!.reconcilePausedAt).toBeNull();
    expect(cleared!.reconcilePausedReason).toBeNull();
  });

  it('leaves an evaluation-error pause for the reconcile job to clear', async () => {
    const { entity } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const errored = await db.segment.update({
      where: { id: entity.id },
      data: {
        reconcilePausedAt: new Date(),
        reconcilePausedReason: SegmentReconcilePauseReason.evaluationError,
        reconcilePausedDetail: 'boom',
      },
    });

    const [still] = await applyPauseVerdicts([errored]);
    expect(still!.reconcilePausedReason).toBe(SegmentReconcilePauseReason.evaluationError);
  });
});
