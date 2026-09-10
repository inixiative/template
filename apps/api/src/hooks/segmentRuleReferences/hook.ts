import type { Condition } from '@inixiative/json-rules';
import { DbAction, HookTiming, registerDbHook, syncRuleReferenceEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
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

export const registerSegmentRuleReferencesHook = () => {
  registerDbHook('segmentRuleReferences', 'Segment', HookTiming.after, ACTIONS, async ({ result }) => {
    for (const segment of castArray((result ?? []) as Segment[])) {
      if (segment.conditions) await syncSegmentEdges(segment);
    }
  });
};
