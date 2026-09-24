/**
 * @atlas
 * @kind query
 * @partOf feature:featureFlag
 * @uses feature:segment
 */
import type { Prisma } from '@template/db';
import { selectSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const includeVariantSegment = {
  segment: {
    select: {
      ...selectSegmentForCustomer,
      featureFlagInternal: true,
      deletedAt: true,
      _count: { select: { members: true } },
    },
  },
} as const satisfies Prisma.FeatureFlagVariantInclude;

export const includeFeatureFlagVariants = {
  variants: { where: { deletedAt: null }, orderBy: { position: 'asc' }, include: includeVariantSegment },
} as const satisfies Prisma.FeatureFlagInclude;

export type VariantRow = Prisma.FeatureFlagVariantGetPayload<{ include: typeof includeVariantSegment }>;

export type FeatureFlagWithVariants = Prisma.FeatureFlagGetPayload<{ include: typeof includeFeatureFlagVariants }>;

const presentSegment = (segment: NonNullable<VariantRow['segment']>) => {
  const { _count, ...summary } = segment;
  return { ...summary, members: _count.members };
};

export const presentVariant = ({ segment, ...variant }: VariantRow) => ({
  ...variant,
  segment: segment ? presentSegment(segment) : null,
});

export const presentFeatureFlag = <T extends { variants: VariantRow[]; sampleOffset: number }>({
  variants,
  sampleOffset: _offset,
  ...flag
}: T) => ({
  ...flag,
  variants: variants.map(presentVariant),
});
