/**
 * Sensitive fields to redact in webhook payloads and audit logs.
 * NOT used by cache.
 */
export const HOOK_REDACT_FIELDS: Record<string, string[]> = {
  Account: ['password'],
  Token: ['keyHash'],
  AuthProvider: ['encryptedSecrets', 'encryptedSecretsMetadata', 'encryptedSecretsKeyVersion'],
};

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
