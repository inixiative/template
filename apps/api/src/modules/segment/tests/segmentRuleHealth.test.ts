import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db, registerSoftDeleteScoper } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganizationUser, createSegment, createSpace } from '@template/db/test';
import { registerRuleReferenceReferencedHook } from '#/hooks/ruleReference/referencedHook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';
import { evaluateSegment, SegmentRuleDegradedError } from '#/modules/segment/services/evaluateSegment';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

const edgesOf = (segmentId: string) => db.ruleReference.findMany({ where: { segmentId } });

describe('segment rule health — the segments a rule names, as edges', () => {
  let space: Space;

  beforeAll(async () => {
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
    registerSegmentConditionsHook();
    registerSegmentRuleReferencesHook();
    registerRuleReferenceReferencedHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
    registerSoftDeleteScoper(null);
  });

  it('saving a membership rule writes one Segment → Segment edge, and re-saving set-diffs it', async () => {
    const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
    const { entity: dependent } = await createSegment({ conditions: membersOf(target.id) }, { space });

    const edges = await edgesOf(dependent.id);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      ownerModel: 'Segment',
      segmentId: dependent.id,
      referencedModel: 'Segment',
      referencedId: target.id,
      referencedSegmentId: target.id,
    });

    await db.segment.update({ where: { id: dependent.id }, data: { conditions: acmeRule } });
    expect(await edgesOf(dependent.id)).toHaveLength(0);
  });

  it('a sound rule reports no issues and evaluates', async () => {
    const { entity: target } = await createSegment({ conditions: acmeRule }, { space });
    const { entity: dependent } = await createSegment({ conditions: membersOf(target.id) }, { space });

    expect((await withSegmentRuleIssues(dependent)).ruleIssues).toEqual([]);
    expect(await evaluateSegment(dependent)).toEqual([]);
  });

  it('a rule naming a segment that is gone is degraded: it evaluates nothing, and the read says why', async () => {
    const { entity: target } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: dependent } = await createSegment(
      { type: SegmentType.dynamic, conditions: membersOf(target.id) },
      { space },
    );

    await db.segment.update({ where: { id: target.id }, data: { deletedAt: new Date() } });

    const { ruleIssues } = await withSegmentRuleIssues(dependent);
    expect(ruleIssues).toEqual([
      {
        kind: 'reference',
        reference: { model: 'Segment', id: target.id },
        detail: `rule names a Segment that no longer resolves: ${target.id}`,
      },
    ]);
    await expect(evaluateSegment(dependent)).rejects.toBeInstanceOf(SegmentRuleDegradedError);

    await db.withDeleted(() => db.segment.update({ where: { id: target.id }, data: { deletedAt: null } }));
    expect((await withSegmentRuleIssues(dependent)).ruleIssues).toEqual([]);
    expect(await evaluateSegment(dependent)).toEqual([]);
  });

  it('a membership loop is refused at save', async () => {
    const { entity: a } = await createSegment({ conditions: acmeRule }, { space });
    const { entity: b } = await createSegment({ conditions: membersOf(a.id) }, { space });

    await expect(db.segment.update({ where: { id: a.id }, data: { conditions: membersOf(b.id) } })).rejects.toThrow(
      'form a loop',
    );
  });
});
