/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField, modelFields } from '#/lib/prisma/fieldMetadata';

export type ChildRelation = {
  field: string;
  model: string;
  hasDeletedAt: boolean;
  fromFields: readonly string[];
  toFields: readonly string[];
};

export const childRelations = (model: string): ChildRelation[] =>
  Object.entries(modelFields(model) ?? {}).flatMap(([field, def]) => {
    if (def.kind !== 'object' || def.fromFields?.length) return [];
    const back = Object.values(modelFields(def.type) ?? {}).find(
      (candidate) => candidate.relationName === def.relationName && candidate.fromFields?.length,
    );
    if (!back?.fromFields?.length || !back.toFields?.length) return [];
    return [
      {
        field,
        model: def.type,
        hasDeletedAt: lookupField(def.type, 'deletedAt') !== undefined,
        fromFields: back.fromFields,
        toFields: back.toFields,
      },
    ];
  });
