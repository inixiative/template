/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Lens, LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';

type RelationFields = Record<string, { fromFields?: readonly string[] }>;

const foreignKeyColumns = (fields: RelationFields): string[] => [
  ...new Set(Object.values(fields).flatMap((field) => field.fromFields ?? [])),
];

const foreignKeyDefaults: NarrowingDefaults = {
  models: Object.fromEntries(
    Object.entries(prismaMap.models as Record<string, { fields: RelationFields }>)
      .map(([model, { fields }]) => [model, { omits: foreignKeyColumns(fields) }] as const)
      .filter(([, { omits }]) => omits.length > 0),
  ),
};

export const omitForeignKeys = (lens: Lens | LensNarrowing): LensNarrowing => ({
  parent: lens,
  mapDefaults: { prisma: foreignKeyDefaults },
});
