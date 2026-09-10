import type { Condition } from '@inixiative/json-rules';
import { DbAction, db, HookTiming, registerDbHook, syncRuleReferenceEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray, isEqual } from 'lodash-es';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

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
    segmentReferences(segment.conditions as Condition, segmentLensFor(segment.ownerModel)).map((id) => ({
      model: 'Segment',
      id,
    })),
  );

type Row = Partial<Segment> & { id: string };

const previousById = (previous: unknown): Map<string, Row> =>
  new Map((castArray(previous ?? []) as Row[]).map((row) => [row.id, row]));

const withConditions = async (row: Row): Promise<Segment | null> =>
  'conditions' in row ? (row as Segment) : db.segment.findUnique({ where: { id: row.id } });

export const registerSegmentRuleReferencesHook = () => {
  registerDbHook('segmentRuleReferences', 'Segment', HookTiming.after, ACTIONS, async ({ result, previous }) => {
    const before = previousById(previous);
    for (const row of castArray((result ?? []) as Row[])) {
      const segment = await withConditions(row);
      if (!segment?.conditions) continue;
      const prior = before.get(segment.id);
      if (prior && 'conditions' in prior && isEqual(prior.conditions, segment.conditions)) continue;
      await syncSegmentEdges(segment);
    }
  });
};
