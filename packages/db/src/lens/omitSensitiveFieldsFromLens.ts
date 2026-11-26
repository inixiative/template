/**
 * @atlas
 * @kind constructor
 * @constructs lens
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { LensNarrowing, NarrowingDefaults } from '@inixiative/json-rules';
import { SENSITIVE_FIELDS } from '@template/db/registries/sensitiveFields';
import { mapValues } from 'lodash-es';

const sensitiveFieldOmitDefaults: NarrowingDefaults = {
  models: mapValues(SENSITIVE_FIELDS, (omits) => ({ omits })),
};

export const omitSensitiveFieldsFromLens = (filterLens: LensNarrowing): LensNarrowing => ({
  parent: filterLens,
  mapDefaults: { prisma: sensitiveFieldOmitDefaults },
});
