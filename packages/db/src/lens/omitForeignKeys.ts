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
import { mapValues, pickBy } from 'lodash-es';

const foreignKeyColumns = (model: string): string[] => [
  ...new Set(
    Object.values(modelOf(prismaMap, model)?.fields ?? {}).flatMap((field) =>
      field.kind === 'object' ? (field.fromFields ?? []) : [],
    ),
  ),
];

const foreignKeyDefaults: NarrowingDefaults = {
  models: pickBy(
    mapValues(prismaMap.models, (_def, model) => ({ omits: foreignKeyColumns(model) })),
    ({ omits }) => omits.length > 0,
  ),
};

export const omitForeignKeys = (lens: Lens | LensNarrowing): LensNarrowing => ({
  parent: lens,
  mapDefaults: { prisma: foreignKeyDefaults },
});
