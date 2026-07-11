/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { CASCADE_EXEMPT } from '#/hooks/softDeleteCascade/cascadeExempt';
import { hasDeletedAt, modelFields, modelNames } from '#/lib/prisma/fieldMetadata';

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
    Object.entries(modelFields(child) ?? {}).flatMap(([field, def]) => {
      if (def.kind !== 'object' || def.type !== model || !def.fromFields?.length || !def.toFields?.length) return [];
      if (CASCADE_EXEMPT[child]?.includes(field)) return [];
      return [
        {
          model: child,
          hasDeletedAt: hasDeletedAt(child),
          fromFields: def.fromFields,
          toFields: def.toFields,
        },
      ];
    }),
  );

  cache.set(model, children);
  return children;
};

// Parked (Aron, 2026-07-11): this is a latent generic schema-graph walker
// (write-time twin of softDeleteScope's query walker). On a third traversal
// use-case, extract to packages/db instead of writing another one.
