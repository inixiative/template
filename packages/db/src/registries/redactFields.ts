/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getEncryptedFieldsByModel } from '@template/db/lib/encryption/registry';

const HOOK_REDACT_FIELDS_BASE: Record<string, string[]> = {
  Account: ['password'],
  Token: ['keyHash'],
};

const mergeEncryptedFields = (base: Record<string, string[]>): Record<string, string[]> => {
  const merged: Record<string, string[]> = { ...base };
  for (const [model, fields] of Object.entries(getEncryptedFieldsByModel())) {
    merged[model] = [...(merged[model] ?? []), ...fields];
  }
  return merged;
};

export const HOOK_REDACT_FIELDS: Record<string, string[]> = mergeEncryptedFields(HOOK_REDACT_FIELDS_BASE);

export const getRedactFields = (model: string): string[] => HOOK_REDACT_FIELDS[model] ?? [];

// The placeholder a redacted value is replaced with. Shared so the audit hook can mask a changed
// sensitive field's before/after to the same token the snapshots use.
export const REDACTED = '[REDACTED]';

export const redactSensitiveFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  redactValue: unknown = REDACTED,
): T => {
  const result = { ...data };
  for (const field of getRedactFields(model)) {
    if (field in result) (result as Record<string, unknown>)[field] = redactValue;
  }
  return result as T;
};
