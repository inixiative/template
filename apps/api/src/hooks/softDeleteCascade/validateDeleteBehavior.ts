/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf } from '@inixiative/field-map';
import {
  HARD_DELETE_ON_TOMBSTONE,
  hasDeletedAt,
  isHardDeletedOnTombstone,
  isModelName,
  modelNames,
  SKIP_REVIVE,
  SOFT_DELETE_MODEL_SET,
} from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { childRelations } from '#/hooks/softDeleteCascade/childRelations';
import { CLOSE_ON_PARENT_DELETE } from '#/hooks/softDeleteCascade/closeOnParentDelete';

const optionalForeignKey = (model: string, fromFields: readonly string[]): boolean => {
  return fromFields.every((name) => fieldOf(prismaMap, model, name)?.isRequired !== true);
};

export const hardDeleteOnTombstoneViolations = (
  models: readonly string[] = HARD_DELETE_ON_TOMBSTONE,
): string[] => {
  const listed = new Set(models);
  const violations: string[] = [];

  for (const model of models) {
    if (!isModelName(model)) {
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

export const skipReviveViolations = (models: readonly string[] = SKIP_REVIVE): string[] =>
  models.flatMap((model) => {
    if (!isModelName(model))
      return [`${model} is listed in SKIP_REVIVE but is not a model in the schema.`];
    if (isHardDeletedOnTombstone(model))
      return [
        `${model} is listed in both SKIP_REVIVE and HARD_DELETE_ON_TOMBSTONE; a hard-deleted row has nothing to skip.`,
      ];
    if (!hasDeletedAt(model))
      return [
        `${model} is listed in SKIP_REVIVE but has no deletedAt column; it is never tombstoned, so there is no revive to skip.`,
      ];
    return [];
  });

export const closeOnParentDeleteViolations = (
  models: readonly string[] = Object.keys(CLOSE_ON_PARENT_DELETE),
): string[] =>
  models.flatMap((model) => {
    if (!isModelName(model))
      return [`${model} is listed in CLOSE_ON_PARENT_DELETE but is not a model in the schema.`];
    return modelNames
      .filter((parent) => childRelations(parent).some((child) => child.model === model))
      .filter((parent) => !SOFT_DELETE_MODEL_SET.has(parent))
      .map(
        (parent) =>
          `${model} is closed on its parent's delete and kept as the record, but its parent ${parent} can be hard-deleted and would take it along. Make ${parent} soft-delete, or point at it with a true-polymorphic pair (model + id, as RuleReference does) instead of a foreign key.`,
      );
  });

export const validateDeleteBehavior = () => {
  const violations = [
    ...hardDeleteOnTombstoneViolations(),
    ...skipReviveViolations(),
    ...closeOnParentDeleteViolations(),
  ];
  if (violations.length)
    throw new Error(
      `[softDeleteCascade] delete behavior is inconsistent:\n  ${violations.join('\n  ')}`,
    );
};
