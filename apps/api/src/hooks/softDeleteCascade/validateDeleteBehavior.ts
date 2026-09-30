/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { HARD_DELETE_ON_TOMBSTONE, SOFT_DELETE_MODEL_SET } from '@template/db';
import { childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { hasDeletedAt, modelFields, modelNames } from '#/lib/prisma/fieldMetadata';

const optionalForeignKey = (model: string, fromFields: readonly string[]): boolean => {
  const fields = modelFields(model);
  return fromFields.every((name) => fields?.[name]?.isRequired !== true);
};

export const deleteBehaviorViolations = (
  models: readonly string[] = HARD_DELETE_ON_TOMBSTONE,
): string[] => {
  const known = new Set(modelNames());
  const listed = new Set(models);
  const violations: string[] = [];

  for (const model of models) {
    if (!known.has(model)) {
      violations.push(
        `${model} is listed in HARD_DELETE_ON_TOMBSTONE but is not a model in the schema.`,
      );
      continue;
    }

    if (hasDeletedAt(model))
      violations.push(
        `${model} is hard-deleted with its parent but has a deletedAt column; it could be revived without the parent it died with. Drop the column or remove it from HARD_DELETE_ON_TOMBSTONE.`,
      );

    if (SOFT_DELETE_MODEL_SET.has(model))
      violations.push(
        `${model} is registered as both hard-delete-on-tombstone and soft-delete; the cascade would call deleteMany and preventHardDelete would refuse it.`,
      );

    for (const child of childRelations(model)) {
      if (listed.has(child.model)) continue;
      if (optionalForeignKey(child.model, child.fromFields)) continue;
      violations.push(
        `${child.model}.${child.fromFields.join('+')} is a required reference to ${model}, which is hard-deleted with its parent, but ${child.model} is not. It would be destroyed by the database below every policy here — list it in HARD_DELETE_ON_TOMBSTONE or exempt the relation in CASCADE_EXEMPT.`,
      );
    }
  }

  return violations;
};

export const validateDeleteBehavior = () => {
  const violations = deleteBehaviorViolations();
  if (violations.length)
    throw new Error(
      `[softDeleteCascade] delete behavior is inconsistent:\n  ${violations.join('\n  ')}`,
    );
};
