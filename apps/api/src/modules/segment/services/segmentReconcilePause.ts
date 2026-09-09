/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { type Db, db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentReconcilePauseReason } from '@template/db/generated/client/enums';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';
import {
  buildReferenceMap,
  findReferenceCycle,
  type ReferenceMap,
} from '#/modules/segment/services/segmentReferenceGraph';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

export type PauseVerdict = { reason: SegmentReconcilePauseReason; detail: string } | null;

const pauseVerdict = (segment: Segment, segments: Segment[], references: ReferenceMap): PauseVerdict => {
  if (!segment.conditions) return null;
  const cycle = findReferenceCycle(references, segment.id);
  if (cycle) return { reason: SegmentReconcilePauseReason.cycle, detail: cycle.join(' -> ') };

  const { ids, dynamic } = segmentReferences(segment.conditions as Condition, segmentLensFor(segment.ownerModel));
  if (dynamic) {
    return {
      reason: SegmentReconcilePauseReason.dynamicReference,
      detail: 'a membership rule reads the referenced segment from a path or bind',
    };
  }
  const known = new Set(segments.map((each) => each.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) return { reason: SegmentReconcilePauseReason.danglingReference, detail: missing.join(', ') };
  return null;
};

export const applyPauseVerdicts = async (segments: Segment[], db: Db = defaultDb): Promise<Segment[]> => {
  const references = buildReferenceMap(segments);
  const next: Segment[] = [];
  for (const segment of segments) {
    const verdict = pauseVerdict(segment, segments, references);
    const paused = !!segment.reconcilePausedAt;
    const evaluationPause = segment.reconcilePausedReason === SegmentReconcilePauseReason.evaluationError;
    if (verdict && (!paused || segment.reconcilePausedReason !== verdict.reason)) {
      next.push(
        await db.segment.update({
          where: { id: segment.id },
          data: {
            reconcilePausedAt: new Date(),
            reconcilePausedReason: verdict.reason,
            reconcilePausedDetail: verdict.detail,
          },
        }),
      );
    } else if (!verdict && paused && !evaluationPause) {
      next.push(
        await db.segment.update({
          where: { id: segment.id },
          data: { reconcilePausedAt: null, reconcilePausedReason: null, reconcilePausedDetail: null },
        }),
      );
    } else {
      next.push(segment);
    }
  }
  return next;
};

export const pauseForEvaluationError = (segmentId: string, error: unknown, db: Db = defaultDb) =>
  db.segment.update({
    where: { id: segmentId },
    data: {
      reconcilePausedAt: new Date(),
      reconcilePausedReason: SegmentReconcilePauseReason.evaluationError,
      reconcilePausedDetail: error instanceof Error ? error.message : String(error),
    },
  });

export const clearEvaluationPause = (segmentId: string, db: Db = defaultDb) =>
  db.segment.updateManyAndReturn({
    where: { id: segmentId, reconcilePausedReason: SegmentReconcilePauseReason.evaluationError },
    data: { reconcilePausedAt: null, reconcilePausedReason: null, reconcilePausedDetail: null },
  });
