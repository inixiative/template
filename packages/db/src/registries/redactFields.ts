/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getEncryptedFieldsByModel } from '@template/db/lib/encryption/registry';
import { type FieldRegistry, NOOP_FIELDS, unionRegistries } from '@template/db/registries/ignoreFields';

const REDACT_FIELDS_BASE: FieldRegistry = {
  Account: ['password'],
  Token: ['keyHash'],
};

// Value-sensitive columns: plaintext-sensitive plus every encrypted column (registering a model for
// encryption is all it takes). Audit MASKS these (records that they changed); webhook DROPS them.
export const REDACT_FIELDS: FieldRegistry = unionRegistries(REDACT_FIELDS_BASE, getEncryptedFieldsByModel());

export const getRedactFields = (model: string): string[] => REDACT_FIELDS[model] ?? [];

// The webhook drop-set: noop noise plus every sensitive column, so a sensitive-only change noops the
// delivery and a sensitive value is never shipped to a receiver.
export const WEBHOOK_DROP_FIELDS: FieldRegistry = unionRegistries(NOOP_FIELDS, REDACT_FIELDS);

// Every sensitive field name across all models — used to mask matching keys in an app-event payload,
// which is an author-built object with no model binding.
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set(Object.values(REDACT_FIELDS).flat());

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

// Masks the before/after of any sensitive field that changed. The diff is computed on unredacted data
// (so the key is present), and masking both sides records THAT the field changed without either value.
export const redactChangeDiff = (
  model: string,
  changes: Record<string, { before: unknown; after: unknown }>,
): Record<string, { before: unknown; after: unknown }> => {
  const sensitive = getRedactFields(model);
  if (!sensitive.length) return changes;
  const sensitiveSet = new Set(sensitive);
  return Object.fromEntries(
    Object.entries(changes).map(([key, delta]) =>
      sensitiveSet.has(key) ? [key, { before: REDACTED, after: REDACTED }] : [key, delta],
    ),
  );
};

// Recursively masks any key named in `keys` anywhere in an app-event payload (through objects and
// arrays). App-event payloads are author-built and not model-bound, so redaction is by field name.
export const redactPayload = <T>(data: T, keys: ReadonlySet<string> = SENSITIVE_KEYS): T => {
  if (Array.isArray(data)) return data.map((item) => redactPayload(item, keys)) as T;
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = keys.has(key) ? REDACTED : redactPayload(value, keys);
    }
    return result as T;
  }
  return data;
};
