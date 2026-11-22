/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  attributeModelViolations,
  type ValidateAttributeModelsOptions,
} from '@template/db/lib/attributes/validation/attributeModelViolations';

/**
 * Validates every model registered in `ATTRIBUTE_MODELS` against Prisma DMMF (`prismaMap`) and
 * required scalar + Postgres GIN indexes. Throws an Error listing all violations if any exist.
 */
export const validateAttributeModels = (options: ValidateAttributeModelsOptions = {}): void => {
  const violations = attributeModelViolations(options);
  if (violations.length > 0) {
    throw new Error(`Invalid ATTRIBUTE_MODELS configuration:\n${violations.join('\n')}`);
  }
};
