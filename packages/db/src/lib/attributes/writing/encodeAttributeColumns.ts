/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import {
  type ResolveAttributeTargetOptions,
  resolveAttributeTarget,
} from '@template/db/lib/attributes/resolveAttributeTarget';
import type { PrismaAttributeColumnPayload } from '@template/db/lib/attributes/types';
import { packAttributeValue } from '@template/db/lib/attributes/writing/packAttributeValue';
import type { ModelName } from '@template/db/utils/modelNames';
import { validateAttributeValue } from '@template/shared/attributes';

/**
 * Validates `value` against the model's registered definition (or explicit `valueType`/`definition`),
 * canonicalizes `multiSelect` arrays, and returns the 5-column Prisma payload.
 */
export const encodeAttributeColumns = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: unknown,
  options?: ResolveAttributeTargetOptions,
): PrismaAttributeColumnPayload => {
  const { config, definition, valueType } = resolveAttributeTarget(model, locator, options);
  const validated = validateAttributeValue(valueType, value, definition?.schema, {
    context: `Invalid value for ${config.model}.${locator}`,
  });
  return packAttributeValue(valueType, validated);
};
