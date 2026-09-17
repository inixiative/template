import type { Condition } from '@inixiative/json-rules';
import { DbAction, db, HookTiming, registerDbHook, ruleReferences, syncRuleReferenceEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray, isEqual, keyBy } from 'lodash-es';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';

const ACTIONS = [
  DbAction.create,
  DbAction.createManyAndReturn,
  DbAction.update,
  DbAction.updateManyAndReturn,
  DbAction.upsert,
];

const syncSegmentEdges = (segment: Segment) =>
  syncRuleReferenceEdges(
    { model: 'Segment', id: segment.id },
    ruleReferences(segmentLensFor(segment.ownerModel), segment.conditions as Condition),
  );

type Row = Partial<Segment> & { id: string };

const withConditions = async (row: Row): Promise<Segment | null> =>
  'conditions' in row ? (row as Segment) : db.segment.findUnique({ where: { id: row.id } });

export const registerSegmentRuleReferencesHook = () => {
  registerDbHook('segmentRuleReferences', 'Segment', HookTiming.after, ACTIONS, async ({ result, previous }) => {
    const before = keyBy(castArray((previous ?? []) as Row[]), 'id');
    for (const row of castArray((result ?? []) as Row[])) {
      const segment = await withConditions(row);
      if (!segment?.conditions) continue;
      const prior = before[segment.id];
      if (prior && 'conditions' in prior && isEqual(prior.conditions, segment.conditions)) continue;
      await syncSegmentEdges(segment);
    }
  });
};
