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

export const redactSensitiveFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  redactValue = '[REDACTED]',
): T => {
  const result = { ...data };
  for (const field of getRedactFields(model)) {
    if (field in result) (result as Record<string, unknown>)[field] = redactValue;
  }
  return result as T;
};
