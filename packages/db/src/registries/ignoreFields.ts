import { getEncryptedFieldsByModel } from '@template/db/lib/encryption/registry';
import { omit } from 'lodash-es';

/**
 * Fields to ignore when determining if a mutation is meaningful.
 * Used by: Cache, Webhooks, Audit logs.
 *
 * Encrypted-column triplets are auto-injected from the encryption registry —
 * ciphertext changes don't carry diffable signal for hook subscribers.
 */
const HOOK_IGNORE_FIELDS_BASE: Record<string, string[]> = {
  _global: ['updatedAt'],
  User: ['lastLoginAt'],
  Token: ['lastUsedAt'],
};

const mergeEncryptedFields = (base: Record<string, string[]>): Record<string, string[]> => {
  const merged: Record<string, string[]> = { ...base };
  for (const [model, fields] of Object.entries(getEncryptedFieldsByModel())) {
    merged[model] = [...(merged[model] ?? []), ...fields];
  }
  return merged;
};

export const HOOK_IGNORE_FIELDS: Record<string, string[]> = mergeEncryptedFields(HOOK_IGNORE_FIELDS_BASE);

export const getIgnoreFields = (model: string): string[] => [
  ...(HOOK_IGNORE_FIELDS._global ?? []),
  ...(HOOK_IGNORE_FIELDS[model] ?? []),
];

export const filterIgnoredFields = <T extends Record<string, unknown>>(model: string, data: T): Partial<T> =>
  omit(data, getIgnoreFields(model)) as Partial<T>;
