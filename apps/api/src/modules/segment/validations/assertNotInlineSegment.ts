/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses none
 */
import type { Segment } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const assertNotInlineSegment = (segment: Pick<Segment, 'featureFlagVariantId'>): void => {
  if (segment.featureFlagVariantId) {
    throw makeError({ status: 422, message: 'an inline segment is edited through its feature flag variant' });
  }
};
