/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { ResolveAttributeTargetOptions } from '@template/db/lib/attributes/resolveAttributeTarget';
import { encodeAttributeColumns } from '@template/db/lib/attributes/writing/encodeAttributeColumns';
import type { ModelName } from '@template/db/utils/modelNames';

export type BuildAttributeUpsertDataOptions = ResolveAttributeTargetOptions & {
  disabled?: boolean;
};

/**
 * Validates `locator` and builds the 5-column
 * write payload for creating or updating an Attribute row.
 */
export const buildAttributeUpsertData = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: unknown,
  options: BuildAttributeUpsertDataOptions = {},
): Record<string, unknown> => {
  const config = attributeModelConfig(model);
  const columns = encodeAttributeColumns(model, locator, value, options);
  return {
    ...columns,
    ...(config.disabledField && options.disabled !== undefined
      ? { [config.disabledField]: options.disabled }
      : {}),
  };
};
