/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type FieldRegistry, unionRegistries } from '@template/db/registries/fieldRegistry';
import { orderedListFieldsByModel } from '@template/db/registries/orderedList';
import { isEqual, omit } from 'lodash-es';

const NOOP_FIELDS_BASE: FieldRegistry = {
  _global: ['updatedAt'],
  User: ['lastLoginAt'],
  Token: ['lastUsedAt'],
  // Live "broken refs" projection for the index list — stamped on the written row by the versioning
  // hook and on its ancestors by the recomputeEmailDependents job; not versioned content (the
  // snapshot's componentVersions is the record). Ignored so updating it neither snapshots nor
  // re-triggers the hook.
  EmailTemplate: ['missingComponentSlugs'],
  EmailComponent: ['missingComponentSlugs'],
};

// Semantically-meaningless change fields: a mutation touching only these is not worth recording or
// firing. Ordered-list position columns fold in; sensitive columns do NOT (those are SENSITIVE_FIELDS —
// audit masks them, webhook drops them via WEBHOOK_EXCLUDED_FIELDS).
export const NOOP_FIELDS: FieldRegistry = unionRegistries(
  NOOP_FIELDS_BASE,
  orderedListFieldsByModel(),
);

export const omitRegisteredFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  registry: FieldRegistry,
): Partial<T> =>
  omit(data, [...(registry._global ?? []), ...(registry[model] ?? [])]) as Partial<T>;

export const isNoOpUpdate = <T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
  registry: FieldRegistry,
): boolean => {
  if (!previousData) return false;
  return isEqual(
    omitRegisteredFields(model, currentData, registry),
    omitRegisteredFields(model, previousData, registry),
  );
};
