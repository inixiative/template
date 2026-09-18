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
import { sweepableSegments } from '#/modules/segment/services/sweepableSegments';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

const membersOf = (segmentId: string) => ({
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: segmentId },
});

describe('sweepable segments — what the nightly sweep enqueues', () => {
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

  it('enqueues sound dynamic segments only: a degraded one is skipped, not warned about by its job', async () => {
    const { entity: target } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: sound } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: degraded } = await createSegment(
      { type: SegmentType.dynamic, conditions: membersOf(target.id) },
      { space },
    );
    const { entity: pinned } = await createSegment({ type: SegmentType.static, conditions: acmeRule }, { space });
    await db.segment.update({ where: { id: target.id }, data: { deletedAt: new Date() } });

    const ids = (await sweepableSegments()).map((segment) => segment.id);
    expect(ids).toContain(sound.id);
    expect(ids).not.toContain(degraded.id);
    expect(ids).not.toContain(pinned.id);
    expect(ids).not.toContain(target.id);
  });
});
