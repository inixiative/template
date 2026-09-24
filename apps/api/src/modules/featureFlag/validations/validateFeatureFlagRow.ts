/**
 * @atlas
 * @kind validator
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma
 */
import type { FeatureFlag } from '@template/db/generated/client/client';
import { isCustomFlagSlug, isFeatureFlagSlug } from '@template/shared/utils';
import { makeError } from '#/lib/errors';
import { featureFlagOwnerIdOf } from '#/modules/featureFlag/lib/featureFlagOwner';
import { assertSegmentUsableBy } from '#/modules/featureFlag/validations/assertSegmentUsableBy';

export type FeatureFlagRow = Partial<FeatureFlag>;

export const validateFeatureFlagRow = async (row: FeatureFlagRow, previous?: FeatureFlag): Promise<void> => {
  if (previous && Object.keys(row).every((column) => column === 'deletedAt')) return;
  const merged = { ...previous, ...row } as FeatureFlag;
  if (row.slug !== undefined || !previous) {
    if (typeof merged.slug !== 'string' || !isFeatureFlagSlug(merged.slug)) {
      throw makeError({ status: 422, message: 'a feature flag slug is a slug, optionally prefixed custom:' });
    }
    if (!isCustomFlagSlug(merged.slug) && merged.ownerModel !== 'platform') {
      throw makeError({ status: 422, message: 'only the platform defines bare flag slugs; prefix yours with custom:' });
    }
  }
  if (merged.segmentId && (row.segmentId !== undefined || !previous)) {
    await assertSegmentUsableBy(merged.segmentId, {
      ownerModel: merged.ownerModel,
      ownerId: featureFlagOwnerIdOf(merged),
    });
  }
};
