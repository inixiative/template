/**
 * @atlas
 * @kind helper
 * @partOf feature:featureFlag
 * @uses none
 */
import type { FeatureFlagValueType } from '@template/db/generated/client/enums';

export type FlagValue = boolean | string | number | Record<string, unknown> | unknown[] | null;

export const zeroFor = (valueType: FeatureFlagValueType): FlagValue => {
  switch (valueType) {
    case 'boolean':
      return false;
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'json':
      return null;
  }
};
