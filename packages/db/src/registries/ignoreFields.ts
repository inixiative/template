/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getOrderedListFieldsByModel } from '@template/db/registries/orderedList';
import { omit } from 'lodash-es';

export type FieldRegistry = Record<string, string[]>;

export const unionRegistries = (...registries: FieldRegistry[]): FieldRegistry => {
  const merged: FieldRegistry = {};
  for (const registry of registries) {
    for (const [model, fields] of Object.entries(registry)) {
      merged[model] = [...new Set([...(merged[model] ?? []), ...fields])];
    }
  }
  return merged;
};

const NOOP_FIELDS_BASE: FieldRegistry = {
  _global: ['updatedAt'],
  User: ['lastLoginAt'],
  Token: ['lastUsedAt'],
  // Live "broken refs" projection for the index list — maintained by the versioning hook, not
  // versioned content (the snapshot's componentVersions is the record). Ignored so updating it
  // neither snapshots nor re-triggers the hook.
  EmailTemplate: ['degradedComponentRefs'],
  EmailComponent: ['degradedComponentRefs'],
};

// Semantically-meaningless change fields: a mutation touching only these is not worth recording or
// firing. Ordered-list position columns fold in; sensitive columns do NOT (those are REDACT_FIELDS —
// audit masks them, webhook drops them via WEBHOOK_DROP_FIELDS).
export const NOOP_FIELDS: FieldRegistry = unionRegistries(NOOP_FIELDS_BASE, getOrderedListFieldsByModel());

export const filterFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  registry: FieldRegistry,
): Partial<T> => omit(data, [...(registry._global ?? []), ...(registry[model] ?? [])]) as Partial<T>;
