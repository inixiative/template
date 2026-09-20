/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { isEqual } from 'lodash-es';
import { applyMembershipDiff, type MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';

export const isReconcilable = (segment: Segment): boolean => !segment.deletedAt && !!segment.conditions;

export const isContinuous = (segment: Segment): boolean =>
  segment.type === SegmentType.dynamic && isReconcilable(segment);

export const segmentNeedsReconcile = (segment: Segment, previous?: Segment): boolean => {
  if (!isReconcilable(segment)) return false;
  if (!previous) return true;
  return (
    !isEqual(previous.conditions, segment.conditions) ||
    (segment.type === SegmentType.dynamic && previous.type !== segment.type)
  );
};

export const reconcileSegment = async (segment: Segment, signal?: AbortSignal): Promise<MembershipDiff> => {
  if (!isReconcilable(segment)) return { added: [], removed: [] };
  const matching = await evaluateSegment(segment);
  if (signal?.aborted) return { added: [], removed: [] };
  return applyMembershipDiff({ segmentId: segment.id, matching });
};
