/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { modelOf } from '@inixiative/field-map';
import {
  hasDeletedAt,
  isArmColumns,
  type ModelName,
  modelNames,
  polymorphismConfigForModel,
} from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { CASCADE_EXEMPT } from '#/hooks/softDeleteCascade/cascadeExempt';

export type ChildRelation = {
  model: string;
  hasDeletedAt: boolean;
  fromFields: readonly string[];
  toFields: readonly string[];
  arm: Record<string, string>;
};

// why: a member arm's keys are a prefix of a deeper arm's (OrganizationUser of SpaceUser), so the relation alone over-reaches.
const armOf = (
  child: ModelName,
  parent: string,
  fromFields: readonly string[],
): Record<string, string> => {
  const axis = polymorphismConfigForModel(child)?.axes.find(
    (candidate) =>
      parent in candidate.fkMap && isArmColumns(child, candidate.field, parent, fromFields),
  );
  return axis ? { [axis.field]: parent } : {};
};

const cache = new Map<string, ChildRelation[]>();

export const childRelations = (model: string): ChildRelation[] => {
  const cached = cache.get(model);
  if (cached) return cached;

  const children = modelNames.flatMap((child) =>
    Object.entries(modelOf(prismaMap, child)?.fields ?? {}).flatMap(([field, def]) => {
      if (
        def.kind !== 'object' ||
        def.type !== model ||
        !def.fromFields?.length ||
        !def.toFields?.length
      )
        return [];
      if (CASCADE_EXEMPT[child]?.includes(field)) return [];
      return [
        {
          model: child,
          hasDeletedAt: hasDeletedAt(child),
          fromFields: def.fromFields,
          toFields: def.toFields,
          arm: armOf(child, model, def.fromFields),
        },
      ];
    }),
  );

  cache.set(model, children);
  return children;
};

// Parked (Aron, 2026-07-11): this is a latent generic schema-graph walker
// (write-time twin of whereWalker's query traversal). On a third traversal
// use-case, extract to packages/db instead of writing another one.
