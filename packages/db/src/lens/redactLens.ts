/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { REDACT_FIELDS } from '@template/db/registries/redactFields';

const redactionDefaults: NarrowingDefaults = {
  models: Object.fromEntries(Object.entries(REDACT_FIELDS).map(([model, omits]) => [model, { omits }])),
};

export const redactLens = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  mapDefaults: { prisma: redactionDefaults },
});
