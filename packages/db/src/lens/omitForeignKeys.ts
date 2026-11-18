/**
 * @atlas
 * @kind constructor
 * @constructs lens
 * @partOf infrastructure:prisma
 * @uses none
 */
import { modelOf } from '@inixiative/field-map';
import type { Lens, LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';

const foreignKeyColumns = (model: string): string[] => [
  ...new Set(
    Object.values(modelOf(prismaMap, model)?.fields ?? {}).flatMap((field) =>
      field.kind === 'object' ? (field.fromFields ?? []) : [],
    ),
  ),
];

const foreignKeyDefaults: NarrowingDefaults = {
  models: Object.fromEntries(
    Object.keys(prismaMap.models)
      .map((model) => [model, { omits: foreignKeyColumns(model) }] as const)
      .filter(([, { omits }]) => omits.length > 0),
  ),
};

export const omitForeignKeys = (lens: Lens | LensNarrowing): LensNarrowing => ({
  parent: lens,
  mapDefaults: { prisma: foreignKeyDefaults },
});
