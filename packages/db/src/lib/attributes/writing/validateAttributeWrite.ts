/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import type { AttributeWriteInspectionOk } from '@template/db/lib/attributes/types';
import {
  type AttributeWriteInspectionOptions,
  attributeWriteInspection,
} from '@template/db/lib/attributes/writing/attributeWriteInspection';
import type { ModelName } from '@template/db/utils/modelNames';

/** Validates an Attribute row write and throws an Error listing all issues on failure. */
export const validateAttributeWrite = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: AttributeWriteInspectionOptions,
): AttributeWriteInspectionOk => {
  const result = attributeWriteInspection(model, row, options);
  if (!result.ok) {
    throw new Error(result.errors.join('; '));
  }
  return result;
};
