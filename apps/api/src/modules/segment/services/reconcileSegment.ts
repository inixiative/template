/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentReconcilePauseReason, SegmentType } from '@template/db/generated/client/enums';
import { applyMembershipDiff, type MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';

const retryablePause = (segment: Segment): boolean =>
  !segment.reconcilePausedAt || segment.reconcilePausedReason === SegmentReconcilePauseReason.evaluationError;

export const isReconcilable = (segment: Segment): boolean =>
  !segment.deletedAt && segment.type === SegmentType.dynamic && !!segment.conditions && retryablePause(segment);

export const reconcileSegment = async (
  segment: Segment,
  db: Db = defaultDb,
  signal?: AbortSignal,
): Promise<MembershipDiff> => {
  if (!isReconcilable(segment)) return { added: [], removed: [] };
  const matching = await evaluateSegment(segment, db);
  if (signal?.aborted) return { added: [], removed: [] };
  return applyMembershipDiff({ segmentId: segment.id, matching }, db);
};
