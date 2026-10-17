import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createSegment,
  createSpace,
} from '@template/db/test';
import { RuleDegradedError } from '@template/shared/rules';
import { registerRuleReferenceTargetHook } from '#/hooks/ruleReference/targetHook';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentRuleReferencesHook } from '#/hooks/segmentRuleReferences/hook';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

const edgesOf = (sourceSegmentId: string) =>
  db.ruleReference.findMany({ where: { sourceSegmentId } });

describe('segment rule health — the segments a rule names, as edges', () => {
  let space: Space;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentRuleReferencesHook();
    registerRuleReferenceTargetHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('saving a membership rule writes one Segment → Segment edge, and re-saving set-diffs it', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    const { entity: dependent } = await createSegment(
      { ownerModel: 'Space', conditions: membersOf(target.id) },
      { space },
    );

    const edges = await edgesOf(dependent.id);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      sourceModel: 'Segment',
      sourceSegmentId: dependent.id,
      targetModel: 'Segment',
      targetId: target.id,
      targetSegmentId: target.id,
    });

    await db.segment.update({ where: { id: dependent.id }, data: { conditions: acmeRule } });
    expect(await edgesOf(dependent.id)).toHaveLength(0);
  });

  it('a sound rule reports no issues and evaluates', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    const { entity: dependent } = await createSegment(
      { ownerModel: 'Space', conditions: membersOf(target.id) },
      { space },
    );

    expect((await withSegmentRuleIssues(dependent)).ruleIssues).toEqual([]);
    expect(await evaluateSegment(dependent)).toEqual([]);
  });

  it('a rule naming a segment that is gone is degraded: it evaluates nothing, and the read says why', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: acmeRule },
      { space },
    );
    const { entity: dependent } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: membersOf(target.id) },
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
    await expect(evaluateSegment(dependent)).rejects.toBeInstanceOf(RuleDegradedError);

    await db.withDeleted(() =>
      db.segment.update({ where: { id: target.id }, data: { deletedAt: null } }),
    );
    expect((await withSegmentRuleIssues(dependent)).ruleIssues).toEqual([]);
    expect(await evaluateSegment(dependent)).toEqual([]);
  });

  it('degradation propagates up the graph: naming a degraded segment degrades the namer, and clears with it', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: acmeRule },
      { space },
    );
    const { entity: middle } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: membersOf(target.id) },
      { space },
    );
    const { entity: top } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: membersOf(middle.id) },
      { space },
    );

    await db.segment.update({ where: { id: target.id }, data: { deletedAt: new Date() } });

    expect((await withSegmentRuleIssues(top)).ruleIssues).toEqual([
      {
        kind: 'reference',
        reference: { model: 'Segment', id: middle.id },
        detail: `rule names a Segment whose own rule is degraded: ${middle.id}`,
      },
    ]);
    await expect(evaluateSegment(top)).rejects.toBeInstanceOf(RuleDegradedError);

    await db.withDeleted(() =>
      db.segment.update({ where: { id: target.id }, data: { deletedAt: null } }),
    );
    expect((await withSegmentRuleIssues(top)).ruleIssues).toEqual([]);
    expect(await evaluateSegment(top)).toEqual([]);
  });

  it('a membership loop is refused at save', async () => {
    const { entity: a } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    const { entity: b } = await createSegment(
      { ownerModel: 'Space', conditions: membersOf(a.id) },
      { space },
    );

    await expect(
      db.segment.update({ where: { id: a.id }, data: { conditions: membersOf(b.id) } }),
    ).rejects.toThrow('form a loop');
  });
});

describe('segment rule health — edge upkeep', () => {
  let space: Space;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentRuleReferencesHook();
    registerRuleReferenceTargetHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('a narrowed update still resyncs the edges', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    const { entity: dependent } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );

    await db.segment.update({
      where: { id: dependent.id },
      data: { conditions: membersOf(target.id) },
      select: { id: true },
    });
    expect(await edgesOf(dependent.id)).toHaveLength(1);
  });

  it('a save that keeps a reference that has since died is allowed; a new dead reference is not', async () => {
    const { entity: target } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    const { entity: dependent } = await createSegment(
      { ownerModel: 'Space', conditions: membersOf(target.id) },
      { space },
    );
    await db.segment.update({ where: { id: target.id }, data: { deletedAt: new Date() } });

    const renamed = await db.segment.update({
      where: { id: dependent.id },
      data: { name: 'renamed', conditions: membersOf(target.id) },
    });
    expect(renamed.name).toBe('renamed');

    const { entity: other } = await createSegment(
      { ownerModel: 'Space', conditions: acmeRule },
      { space },
    );
    await db.segment.update({ where: { id: other.id }, data: { deletedAt: new Date() } });
    await expect(
      db.segment.update({ where: { id: dependent.id }, data: { conditions: membersOf(other.id) } }),
    ).rejects.toThrow('does not own');
  });
});
