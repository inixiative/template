/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getEncryptedFieldsByModel } from '@template/db/lib/encryption/registry';
import { getOrderedListFieldsByModel } from '@template/db/registries/orderedList';
import { omit } from 'lodash-es';

const HOOK_IGNORE_FIELDS_BASE: Record<string, string[]> = {
  _global: ['updatedAt'],
  User: ['lastLoginAt'],
  Token: ['lastUsedAt'],
  // Live "broken refs" projection for the index list — maintained by the versioning hook, not
  // versioned content (the snapshot's componentVersions is the record). Ignored so updating it
  // neither snapshots nor re-triggers the hook.
  EmailTemplate: ['degradedComponentRefs'],
  EmailComponent: ['degradedComponentRefs'],
};

const buildHookIgnoreFields = (): Record<string, string[]> => {
  const merged: Record<string, string[]> = { ...HOOK_IGNORE_FIELDS_BASE };
  const composed = [getEncryptedFieldsByModel(), getOrderedListFieldsByModel()];
  for (const source of composed) {
    for (const [model, fields] of Object.entries(source)) {
      merged[model] = [...(merged[model] ?? []), ...fields];
    }
  }
  return merged;
};

export const HOOK_IGNORE_FIELDS: Record<string, string[]> = buildHookIgnoreFields();

export const getIgnoreFields = (model: string): string[] => [
  ...(HOOK_IGNORE_FIELDS._global ?? []),
  ...(HOOK_IGNORE_FIELDS[model] ?? []),
];

export const filterIgnoredFields = <T extends Record<string, unknown>>(model: string, data: T): Partial<T> =>
  omit(data, getIgnoreFields(model)) as Partial<T>;
