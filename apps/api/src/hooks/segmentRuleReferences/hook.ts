import type { Condition } from '@inixiative/json-rules';
import { sourceQueries } from '@inixiative/json-rules';
import { DbAction, db, HookTiming, registerDbHook, ruleReferences, syncRuleReferenceEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray, isEqual, keyBy } from 'lodash-es';
import { customerRefLens, resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

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
    ruleReferences(customerRefLens, segment.conditions as Condition),
    sourceQueries(resolvedCustomerRefLens(segment.ownerModel, segmentOwnerId(segment))),
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
