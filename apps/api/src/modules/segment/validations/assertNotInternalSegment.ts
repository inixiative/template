/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses none
 */
import type { Segment } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const assertNotInternalSegment = (segment: Pick<Segment, 'featureFlagInternal'>): void => {
  if (segment.featureFlagInternal) {
    throw makeError({ status: 422, message: 'an internal segment is edited through its feature flag variant' });
  }
};
