/**
 * @atlas
 * @kind validator
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { FeatureFlag, FeatureFlagVariant } from '@template/db/generated/client/client';
import type { FeatureFlagValueType } from '@template/db/generated/client/enums';
import { isSlug } from '@template/shared/utils';
import { makeError } from '#/lib/errors';
import { featureFlagOwnerIdOf } from '#/modules/featureFlag/lib/featureFlagOwner';
import { assertSegmentUsableBy } from '#/modules/featureFlag/validations/assertSegmentUsableBy';

export type FeatureFlagVariantRow = Partial<FeatureFlagVariant>;

export const VALUE_COLUMNS: Record<FeatureFlagValueType, keyof FeatureFlagVariant> = {
  boolean: 'valueBoolean',
  string: 'valueText',
  number: 'valueNumber',
  json: 'valueJson',
};

const isSet = (value: unknown): boolean => value !== null && value !== undefined;

export const validateFeatureFlagVariantRow = async (
  row: FeatureFlagVariantRow,
  previous?: FeatureFlagVariant,
  flag?: FeatureFlag,
): Promise<void> => {
  if (previous && Object.keys(row).every((column) => column === 'deletedAt')) return;
  const merged = { ...previous, ...row } as FeatureFlagVariant;
  const parent = flag ?? (await db.featureFlag.findFirst({ where: { id: merged.featureFlagId, deletedAt: null } }));
  if (!parent) throw makeError({ status: 422, message: `FeatureFlag ${merged.featureFlagId} not found` });

  if ((row.label !== undefined || !previous) && (typeof merged.label !== 'string' || !isSlug(merged.label))) {
    throw makeError({ status: 422, message: 'a variant label is a slug' });
  }

  if (merged.isDefault && merged.segmentId) {
    throw makeError({ status: 422, message: 'the default variant has no segment; it serves whoever no rule matched' });
  }
  if (!merged.isDefault && !merged.segmentId) {
    throw makeError({ status: 422, message: 'a rule variant names the segment it serves' });
  }

  const expected = VALUE_COLUMNS[parent.valueType];
  const stray = Object.values(VALUE_COLUMNS).filter((column) => column !== expected && isSet(merged[column]));
  if (!isSet(merged[expected]) || stray.length) {
    throw makeError({
      status: 422,
      message: `a ${parent.valueType} flag's variant sets ${expected} and no other value column`,
    });
  }

  if (merged.segmentId && (row.segmentId !== undefined || !previous)) {
    await assertSegmentUsableBy(merged.segmentId, {
      ownerModel: parent.ownerModel,
      ownerId: featureFlagOwnerIdOf(parent),
      internalTo: previous?.id,
    });
  }
};
