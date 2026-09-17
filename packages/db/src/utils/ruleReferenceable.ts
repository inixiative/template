/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 * @uses none
 */
import { prismaMap } from '@template/db/generated/prismaMap';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import { type ModelName, modelNames } from '@template/db/utils/modelNames';
import { getModelRelations } from '@template/db/utils/prismaMapRelations';

const referencedAxis = getPolymorphismConfig('RuleReference')?.axes.find((axis) => axis.field === 'referencedModel');

/** The models a stored rule may name by id: the referenced axis of the RuleReference registry. */
export const RULE_REFERENCEABLE_MODELS = Object.keys(referencedAxis?.fkMap ?? {}) as ModelName[];

const referenceable = new Set<string>(RULE_REFERENCEABLE_MODELS);

export type RuleReferenceModelDefaults = { sources?: Record<string, true>; omits?: string[] };

/**
 * `mapDefaults` for any lens that can reach a referenceable model: its id is a source on every
 * path to it, and the FK columns that duplicate a relation to it are omitted so a reference has
 * one spelling and always registers.
 */
export const ruleReferenceNarrowingDefaults = (): Record<string, RuleReferenceModelDefaults> => {
  const models: Record<string, RuleReferenceModelDefaults> = {};
  for (const model of RULE_REFERENCEABLE_MODELS) models[model] = { sources: { id: true } };
  for (const model of modelNames) {
    const ownFields = (prismaMap.models as Record<string, { fields: Record<string, unknown> }>)[model]?.fields ?? {};
    const fkColumns = getModelRelations(model)
      .filter((relation) => referenceable.has(relation.targetModel) && relation.foreignKey)
      .flatMap((relation) =>
        typeof relation.foreignKey === 'string' ? [relation.foreignKey] : Object.values(relation.foreignKey ?? {}),
      )
      .filter((column): column is string => typeof column === 'string' && column in ownFields);
    if (!fkColumns.length) continue;
    models[model] = { ...models[model], omits: [...new Set(fkColumns)] };
  }
  return models;
};
