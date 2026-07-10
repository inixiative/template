/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField, modelFields, modelNames } from '#/lib/prisma/fieldMetadata';

export type ChildRelation = {
  model: string;
  hasDeletedAt: boolean;
  fromFields: readonly string[];
  toFields: readonly string[];
};

const cache = new Map<string, ChildRelation[]>();

export const childRelations = (model: string): ChildRelation[] => {
  const cached = cache.get(model);
  if (cached) return cached;

  const children = modelNames().flatMap((child) =>
    Object.values(modelFields(child) ?? {}).flatMap((def) => {
      if (def.kind !== 'object' || def.type !== model || !def.fromFields?.length || !def.toFields?.length) return [];
      return [
        {
          model: child,
          hasDeletedAt: lookupField(child, 'deletedAt') !== undefined,
          fromFields: def.fromFields,
          toFields: def.toFields,
        },
      ];
    }),
  );

  cache.set(model, children);
  return children;
};
