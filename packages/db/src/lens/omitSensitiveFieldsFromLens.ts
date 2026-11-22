/**
 * @atlas
 * @kind constructor
 * @constructs lens
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { SENSITIVE_FIELDS } from '@template/db/registries/sensitiveFields';

const sensitiveFieldOmitDefaults: NarrowingDefaults = {
  models: Object.fromEntries(
    Object.entries(SENSITIVE_FIELDS).map(([model, omits]) => [model, { omits }]),
  ),
};

export const omitSensitiveFieldsFromLens = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  mapDefaults: { prisma: sensitiveFieldOmitDefaults },
});
