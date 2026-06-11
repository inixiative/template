/**
 * @atlas
 * @partOf infrastructure:prisma
 */
import type { LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { HOOK_REDACT_FIELDS } from '@template/db/registries/redactFields';

const redactionDefaults: NarrowingDefaults = {
  models: Object.fromEntries(Object.entries(HOOK_REDACT_FIELDS).map(([model, omits]) => [model, { omits }])),
};

export const redactLens = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  mapDefaults: { prisma: redactionDefaults },
});
