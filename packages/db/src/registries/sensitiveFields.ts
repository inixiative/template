/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getEncryptedFieldsByModel } from '@template/db/lib/encryption/registry';
import { type FieldRegistry, unionRegistries } from '@template/db/registries/noopFields';

const SENSITIVE_FIELDS_BASE: FieldRegistry = {
  Account: ['password'],
  Token: ['keyHash'],
};

// Value-sensitive columns: plaintext-sensitive plus every encrypted column (registering a model for
// encryption is all it takes). Audit MASKS these (records that they changed); webhook DROPS them.
export const SENSITIVE_FIELDS: FieldRegistry = unionRegistries(
  SENSITIVE_FIELDS_BASE,
  getEncryptedFieldsByModel(),
);

export const sensitiveFieldsOf = (model: string): string[] => SENSITIVE_FIELDS[model] ?? [];

// Every sensitive field name across all models — used to mask matching keys in an app-event payload,
// which is an author-built object with no model binding.
export const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(SENSITIVE_FIELDS).flat(),
  'verificationUrl',
]);

export const MASKED_VALUE = '[REDACTED]';

export const maskSensitiveFields = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  redactValue: unknown = MASKED_VALUE,
): T => {
  const result = { ...data };
  for (const field of sensitiveFieldsOf(model)) {
    if (field in result) (result as Record<string, unknown>)[field] = redactValue;
  }
  return result as T;
};

// Masks the before/after of any sensitive field that changed. The diff is computed on unredacted data
// (so the key is present), and masking both sides records THAT the field changed without either value.
export const maskSensitiveFieldsInChangeDiff = (
  model: string,
  changes: Record<string, { before: unknown; after: unknown }>,
): Record<string, { before: unknown; after: unknown }> => {
  const sensitive = sensitiveFieldsOf(model);
  if (!sensitive.length) return changes;
  const sensitiveSet = new Set(sensitive);
  return Object.fromEntries(
    Object.entries(changes).map(([key, delta]) =>
      sensitiveSet.has(key) ? [key, { before: MASKED_VALUE, after: MASKED_VALUE }] : [key, delta],
    ),
  );
};

// Recursively masks any key named in `keys` anywhere in an app-event payload (through objects and
// arrays). App-event payloads are author-built and not model-bound, so redaction is by field name.
export const maskSensitiveFieldsInPayload = <T>(
  data: T,
  keys: ReadonlySet<string> = SENSITIVE_FIELD_NAMES,
): T => {
  if (Array.isArray(data)) return data.map((item) => maskSensitiveFieldsInPayload(item, keys)) as T;
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = keys.has(key) ? MASKED_VALUE : maskSensitiveFieldsInPayload(value, keys);
    }
    return result as T;
  }
  return data;
};
